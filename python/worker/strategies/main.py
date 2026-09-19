from __future__ import annotations

import os
import sys
from pathlib import Path

# Support `python worker/strategies/main.py` without PYTHONPATH.
_PYTHON_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PYTHON_ROOT) not in sys.path:
    sys.path.insert(0, str(_PYTHON_ROOT))

if not os.environ.get("TRADING_ZONE_USER_DATA", "").strip():
    if sys.platform == "win32":
        _user_data = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "trading-zone-electron"
    elif sys.platform == "darwin":
        _user_data = Path.home() / "Library" / "Application Support" / "trading-zone-electron"
    else:
        _config = os.environ.get("XDG_CONFIG_HOME", str(Path.home() / ".config"))
        _user_data = Path(_config) / "trading-zone-electron"
    os.environ["TRADING_ZONE_USER_DATA"] = str(_user_data)

from MingSystemVer1 import MingSystemVer1

if __name__ == "__main__":
    ming_system_ver1 = MingSystemVer1()
    result = ming_system_ver1.run()
    stats = result.get("stats", {}) if isinstance(result, dict) else {}
    print(
        f"{ming_system_ver1.ts_code} {ming_system_ver1.start_date}-{ming_system_ver1.end_date} "
        f"{ming_system_ver1.adjust} bars={stats.get('bar_count', 0)} "
        f"buys={stats.get('buy_count', 0)}"
    )
