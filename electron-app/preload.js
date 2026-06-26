const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Database
  dbGetAll: () => ipcRenderer.invoke("db:getAll"),
  dbGet: (id) => ipcRenderer.invoke("db:get", id),
  dbAdd: (data) => ipcRenderer.invoke("db:add", data),
  dbUpdate: (id, data) => ipcRenderer.invoke("db:update", id, data),
  dbDelete: (id) => ipcRenderer.invoke("db:delete", id),

  // Dialogs
  openCer: () => ipcRenderer.invoke("dialog:openCer"),
  openKey: () => ipcRenderer.invoke("dialog:openKey"),
  selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),
  selectFolderXML: () => ipcRenderer.invoke("dialog:selectFolderXML"),

  // SAT
  satLogin: (clienteId) => ipcRenderer.invoke("sat:login", clienteId),
  satNavigateEmitidas: () => ipcRenderer.invoke("sat:navigateEmitidas"),
  satNavigateRecibidas: () => ipcRenderer.invoke("sat:navigateRecibidas"),
  satDownloadPeriodo: (year, month, tipo, downloadPath) =>
    ipcRenderer.invoke("sat:downloadPeriodo", year, month, tipo, downloadPath),
  satRetrieveDownloads: (downloadPath) =>
    ipcRenderer.invoke("sat:retrieveDownloads", downloadPath),
  satClose: () => ipcRenderer.invoke("sat:close"),

  // Log events from main process
  onSatLog: (callback) => {
    ipcRenderer.on("sat:log", (_, msg) => callback(msg));
  },

  // System
  getHomeDir: () => ipcRenderer.invoke("sys:homeDir"),
  notify: (title, body) => ipcRenderer.invoke("app:notify", title, body),

  // XML
  convertFolder: (folderPath, outputPath) => ipcRenderer.invoke("xml:convertFolder", folderPath, outputPath),
  convertFolderPagos: (folderPath, outputPath) => ipcRenderer.invoke("xml:convertFolderPagos", folderPath, outputPath),
});
