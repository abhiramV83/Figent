import subprocess
import json
try:
    data = subprocess.run(
        ["python","-m","tests.test_static_analysis"],
        capture_output=True,
        text=True,
        timeout=30,
        check=True 
    )

    print(data.stdout)
except subprocess.TimeoutExpired:
    print("The command timed out after 30 seconds.")
except subprocess.CalledProcessError as e:
    print("The script failed with exit code:", e.returncode)
    print("STDERR:", e.stderr)