const { app, BrowserWindow, ipcMain, dialog, Menu, nativeTheme } = require('electron');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300, height: 900,
        backgroundColor: '#00000000', // Для прозрачности
        titleBarStyle: 'hiddenInset', // Красивый заголовок на Mac
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true
        }
    });

    // Авто-обновление темы при изменении в системе
    nativeTheme.on('updated', () => {
        mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
    });

    const menuTemplate = [
        {
            label: 'Файл',
            submenu: [
                { label: 'Открыть локальный JSON...', click: () => mainWindow.webContents.send('menu-action', 'open-local') },
                { label: 'Загрузить Gist', click: () => mainWindow.webContents.send('menu-action', 'load-gist') },
                { type: 'separator' },
                { label: 'Скачать текущую модель', click: () => mainWindow.webContents.send('menu-action', 'download') },
                { type: 'separator' },
                { role: 'quit', label: 'Выход' }
            ]
        },
        {
            label: 'Вид',
            submenu: [
                { role: 'reload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomin' },
                { role: 'zoomout' }
            ]
        },
        {
            label: 'Визуальные эффекты',
            submenu: [
                { label: 'Стандартный', type: 'radio', checked: true, click: () => mainWindow.webContents.send('menu-action', 'shader', 'none') },
                { label: 'PS1 Retro', type: 'radio', click: () => mainWindow.webContents.send('menu-action', 'shader', 'ps1') },
                { label: 'CRT Display', type: 'radio', click: () => mainWindow.webContents.send('menu-action', 'shader', 'crt') },
                { type: 'separator' },
                { label: 'Оптимизация рендера', type: 'checkbox', checked: true, click: (m) => mainWindow.webContents.send('menu-action', 'optimize', m.checked) }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('fetch-model', async (event, { id, theme, extraParams }) => {
    // 1. Чистим ID от старых суффиксов
    const baseId = id.split('_')[0]; 
    
    // 2. Формируем базовые параметры
    const params = new URLSearchParams();
    params.append('id', `${baseId}_${theme}`);
    params.append('format', 'glb');

    // 3. Добавляем ВСЕ экстра-параметры из интерфейса
    if (extraParams) {
        for (const [key, value] of Object.entries(extraParams)) {
            params.append(key, value);
        }
    }

    const finalUrl = `https://core-renderer-tiles.maps.yandex.ru/vmap3/models?${params.toString()}`;
    console.log('--- FETCHING URL:', finalUrl);

    try {
        const response = await axios.get(finalUrl, { 
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        return {
            buffer: response.data,
            fileName: `${baseId}_${theme}.glb`,
            urlUsed: finalUrl
        };
    } catch (e) {
        console.error('--- AXIOS ERROR:', e.message);
        return { error: e.message };
    }
});

ipcMain.handle('save-model', async (event, { buffer, fileName }) => {
    const { filePath } = await dialog.showSaveDialog({
        defaultPath: fileName,
        filters: [{ name: '3D Models', extensions: ['glb'] }]
    });
    if (filePath) {
        fs.writeFileSync(filePath, Buffer.from(buffer));
        return true;
    }
    return false;
});

ipcMain.handle('open-file', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'JSON Registry', extensions: ['json'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null; 
    }

    try {
        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    } catch (e) {
        console.error('Failed to read or parse JSON:', e);
        return null;
    }
});

app.whenReady().then(createWindow);