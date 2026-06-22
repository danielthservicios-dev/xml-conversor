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
  satDownloadPeriodo: (clienteId, year, month, tipo, downloadPath) =>
    ipcRenderer.invoke("sat:downloadPeriodo", clienteId, year, month, tipo, downloadPath),

  // System
  getHomeDir: () => ipcRenderer.invoke("sys:homeDir"),

  // XML
  convertFolder: (folderPath) => ipcRenderer.invoke("xml:convertFolder", folderPath),
});
