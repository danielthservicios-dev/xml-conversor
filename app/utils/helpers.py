import os

LAST_DOWNLOAD_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "last_download_path.txt",
)


def ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def save_last_download_path(path: str):
    os.makedirs(os.path.dirname(LAST_DOWNLOAD_FILE), exist_ok=True)
    with open(LAST_DOWNLOAD_FILE, "w") as f:
        f.write(path)


def get_last_download_path() -> str:
    try:
        with open(LAST_DOWNLOAD_FILE, "r") as f:
            return f.read().strip()
    except (FileNotFoundError, IOError):
        return ""
