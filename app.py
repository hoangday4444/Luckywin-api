import json
import threading
import time
import os
import logging
from urllib.request import urlopen, Request
from flask import Flask, jsonify

# Thiết lập log
logging.basicConfig(level=logging.INFO,
                    format='[%(asctime)s] [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Cấu hình chung
HOST = '0.0.0.0'
POLL_INTERVAL = 3  # Polling 3 giây
RETRY_DELAY = 5
MAX_HISTORY = 50

# Khởi tạo khóa và store cho bàn MD5
lock = threading.Lock() 

latest_result = {
    "Phien": 0, "Xuc_xac_1": 0, "Xuc_xac_2": 0, "Xuc_xac_3": 0,
    "Tong": 0, "Ket_qua": "Chưa có", "md5": None, "rs": None, "id": "Ho4g4H" 
}

history = []
last_sid = None

# Hàm kiểm tra Tài/Xỉu
def get_tai_xiu(d1, d2, d3):
    total = d1 + d2 + d3
    return "Xỉu" if total <= 10 else "Tài" 


# Hàm cập nhật kết quả (Đa luồng an toàn)
def update_result(store, history, lock, result):
    with lock:
        store.clear()
        store.update(result)
        history.insert(0, result.copy())
        if len(history) > MAX_HISTORY:
            history.pop()

# Hàm Polling chính (Chạy đa luồng)
def poll_api():
    global last_sid
    # API Dự phòng cho Tài Xỉu MD5 (gid=vgmn_101)
    url = "https://api-agent.gowsazhjo.net/glms/v1/notify/taixiu?platform_id=b5&gid=vgmn_101"
    while True:
        try:
            req = Request(url, headers={'User-Agent': 'Python-Proxy/1.0'})
            with urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))

            if data.get('status') == 'OK' and isinstance(data.get('data'), list):

                for game in data['data']:
                    cmd = game.get("cmd")

                    if cmd == 2006:
                        # Kết quả MD5 nằm trong cmd=2006
                        sid = game.get("sid")
                        d1, d2, d3 = game.get("d1"), game.get("d2"), game.get("d3")
                        md5_val = game.get("md5")
                        rs_val = game.get("rs")

                        if sid and sid != last_sid and None not in (d1, d2, d3):
                            last_sid = sid
                            total = d1 + d2 + d3
                            ket_qua = get_tai_xiu(d1, d2, d3)
                            result = {
                                "Phien": sid,
                                "Xuc_xac_1": d1,
                                "Xuc_xac_2": d2,
                                "Xuc_xac_3": d3,
                                "Tong": total,
                                "Ket_qua": ket_qua,
                                "md5": md5_val,
                                "rs": rs_val,
                                "id": "Ho4g4H"
                            }
                            update_result(latest_result, history, lock, result)
                            logger.info(f"[MD5] Phiên {sid} - Tổng: {total}, Kết quả: {ket_qua}")
                            break 
        except Exception as e:
            logger.error(f"Lỗi khi lấy dữ liệu API MD5: {e}")
            time.sleep(RETRY_DELAY)

        time.sleep(POLL_INTERVAL)


# --- Thiết lập Flask (API) ---
app = Flask(__name__)

# Endpoint Lấy kết quả Tài Xỉu MD5
@app.route("/api/taixiumd5", methods=["GET"])
def get_taixiu_101():
    with lock:
        return jsonify(latest_result)

# Endpoint Lấy lịch sử
@app.route("/api/history", methods=["GET"])
def get_history():
    with lock:
        return jsonify({
            "taixiumd5": history
        })

# Endpoint gốc
@app.route("/")
def index():
    return "API Server Ho4g4H (Python) đang hoạt động. Chỉ có bàn Tài Xỉu MD5. Endpoints: /api/taixiumd5, /api/history"


if __name__ == "__main__":
    logger.info("Khởi động hệ thống API Tài Xỉu MD5 (Python)...")
    # Khởi động Polling cho bàn Tài Xỉu MD5 trên luồng riêng
    thread_101 = threading.Thread(target=poll_api, daemon=True)
    thread_101.start()
    logger.info("Đã bắt đầu polling dữ liệu đa luồng.")
    # Chạy Server trên cổng của Render
    port = int(os.environ.get("PORT", 8000))
    app.run(host=HOST, port=port)
