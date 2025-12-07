// file: server.js (VERSION 3.0 - Dùng API Dự phòng & Polling Cực nhanh)
const express = require('express');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// THAY ĐỔI: Sử dụng API dự phòng có độ trễ thấp hơn
const TARGET_API_URL = 'https://api-agent.gowsazhjo.net/glms/v1/notify/taixiu?platform_id=b5&gid=vgmn_101'; 
const POLLING_INTERVAL = 2000; // Polling 2 giây (2000 milliseconds)
const MAX_HISTORY = 50; 

const history_taixiu = [];
let latest_result = { Phien: 0, Tong: 0, Ket_qua: "Chưa có", id: "Ho4g4H" };

function get_tai_xiu(d1, d2, d3) {
    const total = d1 + d2 + d3;
    return total >= 11 ? "Tài" : "Xỉu"; 
}

function update_result(result) {
    latest_result = { ...result };
    history_taixiu.unshift(latest_result);
    if (history_taixiu.length > MAX_HISTORY) {
        history_taixiu.pop();
    }
}

let last_sid = null;

// HÀM POLLING TỰ ĐỘNG CHẠY VỚI THỜI GIAN NHANH HƠN
async function pollLuckyWinApi() {
    try {
        const response = await fetch(TARGET_API_URL);
        const data = await response.json();
        
        if (data.status === 'OK' && data.data) {
            
            // Tìm kết quả phiên mới nhất
            let latest_game_result = null;
            let sid_for_result = null;

            for (const game of data.data) {
                if (game.cmd === 2006) {
                    // Lấy dữ liệu Xúc xắc và MD5
                    latest_game_result = game;
                }
                if (game.cmd === 2007) {
                    // Lấy SID (Số phiên)
                    sid_for_result = game.sid;
                }
            }

            if (latest_game_result && sid_for_result) {
                const { d1, d2, d3, md5, rs } = latest_game_result;
                const sid = sid_for_result;

                if (sid && sid !== last_sid && d1 && d2 && d3) {
                    last_sid = sid;
                    const total = d1 + d2 + d3;
                    const ket_qua = get_tai_xiu(d1, d2, d3);
                    
                    const new_result = {
                        Phien: sid,
                        Xuc_xac_1: d1,
                        Xuc_xac_2: d2,
                        Xuc_xac_3: d3,
                        Tong: total,
                        Ket_qua: ket_qua,
                        md5: md5,
                        rs: rs,
                        id: "Ho4g4H" // Đã đặt ID theo yêu cầu của Chủ Nhân
                    };
                    
                    update_result(new_result);
                    console.log(`[Ho4g4H] PHIÊN MỚI: ${new_result.Phien} - ${new_result.Ket_qua}`);
                }
            }
        }
    } catch (error) {
        // Lỗi này thường xảy ra khi API gốc quá chậm hoặc tạm thời không phản hồi
        console.error("Lỗi Polling (API gốc chậm):", error.message);
    }
    
    // Đảm bảo hàm tự gọi lại sau khoảng thời gian ngắn
    setTimeout(pollLuckyWinApi, POLLING_INTERVAL); 
}

// --- Thiết lập API Server và Vô hiệu hóa CORS Tuyệt đối ---
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*'); 
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ENDPOINT LẤY KẾT QUẢ MỚI NHẤT
app.get("/api/taixiumd5", (req, res) => {
    return res.json(latest_result);
});

// ENDPOINT LẤY LỊCH SỬ
app.get("/api/history", (req, res) => {
    return res.json({ taixiumd5: history_taixiu });
});

app.get("/", (req, res) => {
    res.send("API Server Ho4g4H đang hoạt động tối đa. (Đã sử dụng API dự phòng để tăng tốc)");
});

// --- Khởi chạy Server và Bắt đầu Polling ---
app.listen(PORT, () => {
    console.log(`API Server đang hoạt động trên cổng ${PORT}`);
    // Bắt đầu quá trình Polling
    pollLuckyWinApi();
});
