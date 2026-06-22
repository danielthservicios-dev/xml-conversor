import customtkinter as ctk
from app.gui.clients_tab import ClientsTab
from app.gui.download_tab import DownloadTab
from app.gui.convert_tab import ConvertTab


class MainWindow(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("SAT XML Conversor")
        self.geometry("1000x700")

        ctk.set_appearance_mode("system")
        ctk.set_default_color_theme("green")

        self.tab_view = ctk.CTkTabview(self)
        self.tab_view.pack(fill="both", expand=True, padx=10, pady=10)

        self.tab_clients = self.tab_view.add("Clientes")
        self.tab_download = self.tab_view.add("Descargar XML")
        self.tab_convert = self.tab_view.add("Convertir a Excel")

        self.clients_tab = ClientsTab(self.tab_clients)
        self.download_tab = DownloadTab(self.tab_download)
        self.convert_tab = ConvertTab(self.tab_convert)
