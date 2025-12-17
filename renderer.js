const viewer = document.getElementById('viewer');
const statusOverlay = document.getElementById('status-overlay'); // Новый HUD
const listContainer = document.getElementById('list');
const gistInput = document.getElementById('gistUrl');
const themeInput = document.getElementById('themeInput');
const sidebar = document.getElementById('sidebar');
const toggleBtn = document.getElementById('toggle-sidebar');

let currentModelId = '';
let lastBuffer = null;
let currentFileName = '';

// --- 1. ЗАГРУЗКА СПИСКА МОДЕЛЕЙ ---
async function loadList() {
    const url = gistInput.value.trim();
    if (!url) return;
    
    status.innerText = 'Подключение к Gist...';
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        
        localStorage.setItem('lastGist', url);
        renderList(data);
        status.innerText = `Найдено моделей: ${data.length}`;
    } catch (e) {
        console.error('Gist Load Error:', e);
        status.innerText = 'Ошибка: неверный JSON или URL';
    }
}

function renderList(items) {
    listContainer.innerHTML = '';
    if (!Array.isArray(items)) {
        status.innerText = 'Ошибка: JSON должен быть массивом';
        return;
    }

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'model-item';
        // Если в JSON другие ключи (например, N или URL), можно добавить их сюда
        div.innerHTML = `<strong>${item.Название || 'Без названия'}</strong><br><small>${item.id}</small>`;
        
        div.onclick = () => {
            document.querySelectorAll('.model-item').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            
            currentModelId = item.id;
            updateModel();
        };
        listContainer.appendChild(div);
    });
}

// --- 2. ОБНОВЛЕНИЕ 3D МОДЕЛИ ---
async function updateModel() {
    if (!currentModelId) return;
    status.innerText = 'Загрузка 3D данных...';
    const extraParams = {};
    document.querySelectorAll('[data-key]').forEach(el => {
        if (el.type === 'checkbox') {
            if (el.checked) extraParams[el.dataset.key] = el.value;
        } else {
            if (el.value) extraParams[el.dataset.key] = el.value;
        }
    });

    const theme = themeInput.value;

    try {
        const result = await window.api.fetchModel({
            id: currentModelId,
            theme: theme,
            extraParams: extraParams
        });

        if (result && result.buffer) {
            lastBuffer = result.buffer;
            currentFileName = result.fileName;
            const blob = new Blob([result.buffer], { type: 'model/gltf-binary' });
            const url = URL.createObjectURL(blob);
    
            if (viewer.src && viewer.src.startsWith('blob:')) {
                URL.revokeObjectURL(viewer.src);
            }

            viewer.src = url;
            
            viewer.addEventListener('load', () => {
                status.innerText = 'Отображение: ' + currentFileName;
                // Авто-фокус на модели
                viewer.jumpCameraToGoal();
            }, { once: true });

        } else {
            status.innerText = 'Ошибка: ' + (result.error || 'Модель не найдена (404)');
        }
    } catch (err) {
        console.error('IPC Fetch Error:', err);
        status.innerText = 'Ошибка вызова API';
    }
}

// --- 3. СКАЧИВАНИЕ ---
async function downloadCurrent() {
    if (!lastBuffer) {
        alert('Сначала выберите и загрузите модель');
        return;
    }
    const ok = await window.api.saveModel({ buffer: lastBuffer, fileName: currentFileName });
    if (ok) status.innerText = 'Файл успешно сохранен';
}

// --- 4. АВТОМАТИЗАЦИЯ И СЛУШАТЕЛИ ---
function setupAutoUpdate() {
    let timer;
    
    // Авто-загрузка списка при вводе в поле Gist
    gistInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(loadList, 1000);
    });

    // Авто-обновление модели при смене темы или галочек
    const configInputs = document.querySelectorAll('#themeInput, #extraParams input');
    configInputs.forEach(input => {
        input.addEventListener('change', () => updateModel());
        
        if (input.type === 'text') {
            input.addEventListener('input', () => {
                clearTimeout(timer);
                timer = setTimeout(updateModel, 800);
            });
        }
    });
}

window.api.onMenuAction(async (action, value) => {
    console.log("Recieved from Main:", action);
    const container = document.getElementById('viewer-container');
    if (action === 'open-local') {
        const data = await window.api.openFile(); // Вызывает диалог выбора файла
        if (data) {
            // Блокируем ввод URL
            const gistInput = document.getElementById('gistUrl');
            gistInput.value = "LOCAL_REGISTRY_ACTIVE";
            gistInput.disabled = true;
            gistInput.style.opacity = "0.5";
            gistInput.style.pointerEvents = "none";
            
            renderList(data);
            setStatus('Local File Loaded');
        }
    }
    
    if (action === 'load-gist') {
        // Разблокируем обратно для Gist
        const gistInput = document.getElementById('gistUrl');
        gistInput.disabled = false;
        gistInput.style.opacity = "1";
        gistInput.style.pointerEvents = "all";
        loadList();
    }
    
    if (action === 'download') downloadCurrent();

    // Управление шейдерами/стилями
    if (action === 'shader') {
            container.classList.remove('ps1-style', 'crt-effect');
            if (value === 'ps1') {
                container.classList.add('ps1-style'); 
                viewer.setAttribute('minimum-render-scale', '0.05');
                viewer.shadowSoftness = 0;
            } else if (value === 'crt') {
                container.classList.add('crt-effect', 'crt-flicker');
                viewer.setAttribute('minimum-render-scale', '1');
            } else {
                viewer.setAttribute('minimum-render-scale', '1');
            }
        }

    // Ключи оптимизации
    if (action === 'optimize') {
        if (value) {
            viewer.setAttribute('power-preference', 'high-performance');
            viewer.removeAttribute('interpolation-decay');
            setStatus('OPTIMIZATION: ON');
        } else {
            viewer.setAttribute('power-preference', 'default');
            setStatus('OPTIMIZATION: OFF');
        }
    }
});

toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('hidden');
    // Опционально: меняем текст кнопки
    toggleBtn.innerText = sidebar.classList.contains('hidden') ? '☰ SHOW' : '✕ HIDE';
});

// Старт приложения
setupAutoUpdate();

if (localStorage.getItem('lastGist')) {
    gistInput.value = localStorage.getItem('lastGist');
    loadList();
}