const API_URL = 'https://script.google.com/macros/s/AKfycbzkAfec7NAf5vC7GV7xMSKEwxbaViIoMCoXKDuaDULZeOZ-bR0wlmipSsPGGRwYdbgx4w/exec'; 

const COMPONENTS = ['Louver', 'Jamb', 'Rail', 'Mecanismo', 'Interlock', 'Lightblock', 'Flex', 'Divider', 'Tier Louver'];

const PROBLEMS = {
    'Louver': ['Rayado', 'Sucio', 'Hundimiento', 'Corto', 'Largo', 'Mal ensamble', 'Puntos negro', 'Punto blanco', 'Pando', 'Rasguno por manejo', 'Manchado', 'Tapas equivocadas', 'Quebrado/Despostillado', 'Louver no cierra correctamente', 'Falta de pegamento', 'Notch equivocado'],
    'Jamb': ['Rayado', 'Sucio', 'Hundimiento', 'Corto', 'Largo', 'Mal ensamble', 'Puntos negro', 'Punto blanco', 'Rasguno por manejo', 'Manchado', 'Mal posicion del divider', 'Perforacion incorrecta', 'Configuracion incorrecta', 'Quebrado/Despostillado'],
    'Rail': ['Rayado', 'Sucio', 'Hundimiento', 'Corto', 'Largo', 'Mal ensamble', 'Puntos negro', 'Punto blanco', 'Rasguno por manejo', 'Manchado', 'Quebrado/Despostillado', 'Corte Chueco'],
    'Mecanismo': ['Corto', 'Largo', 'Sucio', 'Rayado', 'Split incorrecto', 'Pando', 'Corte Chueco', 'Marcado', 'Falla Carrito'],
    'Interlock': ['Corto', 'Largo', 'Sucio', 'Manchado', 'Despostillado', 'Mala dimencion'],
    'Lightblock': ['Corto', 'Largo', 'Sucio', 'Manchado', 'Despostillado', 'Mala dimencion'],
    'Flex': ['Corto', 'Largo', 'Sucio', 'Manchado', 'Despostillado', 'Mala dimencion'],
    'Divider': ['Rayado', 'Sucio', 'Hundimiento', 'Corto', 'Largo', 'Mal ensamble', 'Puntos negro', 'Punto blanco', 'Rasguno por manejo', 'Divider Equivocado', 'Manchado', 'Quebrado/Despostillado', 'Corte Chueco'],
    'Tier Louver': ['Falta de componente', 'Falta de pegamento en tapas', 'Louver sin identificar']
};

const REWORK_ACTIONS = ['Se corto', 'Se lija', 'Se limpio', 'Se cambio de posicion', 'Se volvio a perforar', 'Se cambio de componente', 'Se agrego componente'];

let appState = {
    employeeId: localStorage.getItem('employeeId'),
    shopFloorId: null,
    component: null,
    quantity: null,
    mechanismType: null,
    problemType: null,
    isReworkCycle: false
};

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
    renderDynamicLists();
    setupScannerListeners();
    
    if (appState.employeeId) {
        document.getElementById('user-greeting').innerText = `Empleado: ${appState.employeeId}`;
        loadEmployeeStats();
        showScreen('screen-scan-ticket');
    } else {
        showScreen('screen-login');
    }
});

// --- MANEJO DEL ESCÁNER FÍSICO (ENTER) ---
function setupScannerListeners() {
    document.getElementById('input-login').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') processLogin();
    });

    document.getElementById('input-ticket').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') processTicket();
    });

    document.getElementById('input-quantity').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') saveQuantity();
    });
}

// --- RENDERIZADO DINÁMICO ---
function renderDynamicLists() {
    const compDiv = document.getElementById('components-list');
    compDiv.innerHTML = '';
    COMPONENTS.forEach(comp => {
        let btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.innerText = comp;
        btn.onclick = () => selectComponent(comp);
        compDiv.appendChild(btn);
    });

    const rewDiv = document.getElementById('rework-actions-list');
    rewDiv.innerHTML = '';
    REWORK_ACTIONS.forEach(act => {
        let btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.innerText = act;
        btn.onclick = () => processReworkAction(act);
        rewDiv.appendChild(btn);
    });
    
    let btnFail = document.createElement('button');
    btnFail.className = 'btn btn-danger';
    btnFail.innerText = 'No quedó';
    btnFail.style.marginTop = '24px';
    btnFail.onclick = () => showScreen('screen-fail-reason');
    rewDiv.appendChild(btnFail);
    
    let btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-secondary';
    btnCancel.innerText = 'Cancelar';
    btnCancel.onclick = resetApp;
    rewDiv.appendChild(btnCancel);
}

// --- CONTROL DE PANTALLAS ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');
    
    setTimeout(() => {
        if (screenId === 'screen-login') document.getElementById('input-login').focus();
        if (screenId === 'screen-scan-ticket') document.getElementById('input-ticket').focus();
        if (screenId === 'screen-quantity') document.getElementById('input-quantity').focus();
        if (screenId === 'screen-fail-reason') renderFailReasons();
    }, 100);
}

function toggleLoader(show) {
    document.getElementById('loader').classList.toggle('active', show);
}

// Cargar estadísticas del empleado
async function loadEmployeeStats() {
    if (!appState.employeeId) return;
    
    try {
        const res = await fetch(`${API_URL}?action=getStats&employeeId=${encodeURIComponent(appState.employeeId)}`);
        const data = await res.json();
        
        if (data.totalToday !== undefined) {
            document.getElementById('total-today-count').innerText = data.totalToday;
            renderHourlyStats(data.hourlyCounts);
        }
    } catch (e) {
        console.error("Error al obtener estadísticas", e);
    }
}

function renderHourlyStats(hourlyData) {
    const grid = document.getElementById('hourly-grid');
    if (!grid) return;
    grid.innerHTML = '';

    for (const [block, count] of Object.entries(hourlyData)) {
        const item = document.createElement('div');
        item.className = `hourly-item ${count > 0 ? 'active' : ''}`;
        
        const hourLabel = block.split(' - ')[0];
        
        item.innerHTML = `
            <span class="hour-label">${hourLabel}</span>
            <span class="hour-count">${count}</span>
        `;
        grid.appendChild(item);
    }
}

// --- FLUJOS DE NEGOCIO ---
function processLogin() {
    const empId = document.getElementById('input-login').value.trim().toUpperCase();
    const regexFormat = /^0\d{5}A$/;

    if (!empId) return alert("Escanea o ingresa tu gafete.");
    if (!regexFormat.test(empId)) {
        document.getElementById('input-login').value = ''; 
        return alert("Formato inválido. El gafete debe iniciar con '0', seguido de 5 números y terminar con 'A'.");
    }
    
    appState.employeeId = empId;
    localStorage.setItem('employeeId', empId);
    document.getElementById('user-greeting').innerText = `Empleado: ${appState.employeeId}`;
    document.getElementById('input-login').value = '';
    
    loadEmployeeStats();
    showScreen('screen-scan-ticket');
}

async function processTicket() {
    const inputElem = document.getElementById('input-ticket');
    const ticketId = inputElem.value.trim();

    if (!ticketId) {
        alert("Por favor, escanea o ingresa el ticket.");
        inputElem.focus();
        return;
    }

    appState.shopFloorId = ticketId;
    document.getElementById('lbl-ticket').innerText = ticketId;
    inputElem.value = '';
    toggleLoader(true);

    try {
        const response = await fetch(`${API_URL}?shopFloorId=${encodeURIComponent(ticketId)}`);
        const data = await response.json();
        toggleLoader(false);

        if (data.exists && data.status === 'En cola') {
            appState.isReworkCycle = true;
            if (data.component) appState.component = data.component;
            if (data.quantity) appState.quantity = data.quantity;
            if (data.mechanismType) appState.mechanismType = data.mechanismType;
            if (data.problemType) appState.problemType = data.problemType;
            showScreen('screen-rework-action');
        } else {
            appState.isReworkCycle = false;
            showScreen('screen-decision');
        }
    } catch (error) {
        toggleLoader(false);
        console.error("Error al consultar ticket:", error);
        alert("Error de conexión al consultar el ticket.");
        resetApp();
    }
}

// --- SELECCIÓN DE DEFECTO ---
function selectComponent(comp) {
    appState.component = comp;
    if (comp === 'Louver') showScreen('screen-quantity');
    else if (comp === 'Mecanismo') showScreen('screen-mechanism-type');
    else {
        renderProblemsList(comp);
        showScreen('screen-problem');
    }
}

function saveQuantity() {
    const q = document.getElementById('input-quantity').value;
    if (!q) return alert("Ingresa una cantidad");
    appState.quantity = q;
    document.getElementById('input-quantity').value = '';
    renderProblemsList('Louver');
    showScreen('screen-problem');
}

function saveMechanism(type) {
    appState.mechanismType = type;
    renderProblemsList('Mecanismo');
    showScreen('screen-problem');
}

function renderProblemsList(component) {
    const container = document.getElementById('problems-list');
    container.innerHTML = '';
    if (PROBLEMS[component]) {
        PROBLEMS[component].forEach(prob => {
            let btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.style.marginBottom = '8px';
            btn.innerText = prob;
            btn.onclick = () => {
                appState.problemType = prob;
                showScreen('screen-rework-dest');
            };
            container.appendChild(btn);
        });
    }
}

function renderFailReasons() {
    const container = document.getElementById('fail-reasons-list');
    container.innerHTML = '';
    
    const reasons = (appState.component && PROBLEMS[appState.component]) 
        ? PROBLEMS[appState.component] 
        : ['Sigue igual', 'Nuevo daño', 'Mal retrabajo', 'Falta material'];
    
    reasons.forEach(reason => {
        let btn = document.createElement('button');
        btn.className = 'btn btn-secondary';
        btn.style.marginBottom = '8px';
        btn.innerText = reason;
        btn.onclick = () => {
            sendData({ 
                status: 'En cola', 
                failReason: reason, 
                incrementCounter: true 
            });
        };
        container.appendChild(btn);
    });
    
    let btnCancel = document.createElement('button');
    btnCancel.className = 'btn';
    btnCancel.innerText = 'Volver';
    btnCancel.onclick = () => showScreen('screen-rework-action');
    container.appendChild(btnCancel);
}

// --- ENVÍO DE DATOS A APPS SCRIPT ---
async function sendData(payloadExtension) {
    if (!appState.shopFloorId) {
        alert("Error: No se ha detectado el ticket.");
        resetApp();
        return;
    }

    toggleLoader(true);
    const payload = {
        employeeId: appState.employeeId,
        shopFloorId: appState.shopFloorId,
        component: appState.component,
        quantity: appState.quantity,
        mechanismType: appState.mechanismType,
        problemType: appState.problemType,
        ...payloadExtension
    };

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        toggleLoader(false);

        if (result.success) {
            resetApp();
        } else {
            alert("Error al guardar: " + (result.error || "desconocido"));
        }
    } catch (error) {
        toggleLoader(false);
        console.error("Error al enviar datos:", error);
        alert("Error de conexión al guardar los datos.");
    }
}

// --- ACCIONES FINALES ---
function processOK() { 
    sendData({ status: 'OK' }); 
}

function processSendToReworkQueue() { 
    sendData({ status: 'En cola' }); 
}

function processReworkAction(actionText) {
    sendData({
        status: 'Cerrado',
        reworkAction: actionText,
        incrementCounter: appState.isReworkCycle
    });
}

// --- UTILIDADES ---
function resetApp() {
    appState.shopFloorId = null;
    appState.component = null;
    appState.quantity = null;
    appState.mechanismType = null;
    appState.problemType = null;
    appState.isReworkCycle = false;
    
    const input = document.getElementById('input-ticket');
    if (input) input.value = '';
    
    loadEmployeeStats();
    showScreen('screen-scan-ticket');
}

function logout() {
    localStorage.removeItem('employeeId');
    appState.employeeId = null;
    document.getElementById('input-login').value = '';
    showScreen('screen-login');
}
