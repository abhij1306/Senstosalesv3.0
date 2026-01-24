import os
import subprocess


def open_folder_picker(initial_dir: str = "") -> str | None:
    """
    Opens a folder picker dialog using PowerShell (System.Windows.Forms).
    This is more robust than ctypes for capturing the return value across threads.
    """
    try:
        # PowerShell command to open FolderBrowserDialog
        # -NoProfile -NonInteractive speeds it up
        # We use System.Windows.Forms for the dialog

        # Prepare initial dir path (escape for Powershell)
        init_dir_arg = ""
        if initial_dir and os.path.isdir(initial_dir):
            # Simple escape for single quotes
            clean_dir = initial_dir.replace("'", "''")
            init_dir_arg = f"$d.SelectedPath = '{clean_dir}';"

        ps_script = f"""
        Add-Type -AssemblyName System.Windows.Forms;
        $d = New-Object System.Windows.Forms.FolderBrowserDialog;
        $d.Description = 'Select Download Folder';
        $d.ShowNewFolderButton = $true;
        {init_dir_arg}
        if ($d.ShowDialog() -eq 'OK') {{ Write-Host $d.SelectedPath }}
        """

        cmd = ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps_script]

        # creationflags=0x08000000 (CREATE_NO_WINDOW) prevents the black console window flashing on Windows
        creation_flags = 0x08000000 if os.name == "nt" else 0

        result = subprocess.run(cmd, capture_output=True, text=True, creationflags=creation_flags)

        path = result.stdout.strip()
        if path and os.path.isdir(path):
            return path

        return None

    except Exception as e:
        print(f"Picker error: {e}")
        return None


if __name__ == "__main__":
    print(open_folder_picker())
