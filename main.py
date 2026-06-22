from app.gui.main_window import MainWindow
from app.core.db import init_db


def main():
    init_db()
    app = MainWindow()
    app.mainloop()


if __name__ == "__main__":
    main()
