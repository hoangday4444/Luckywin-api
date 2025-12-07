// file: server.js
const express = require('express');
const fetch = require('node-fetch');
const cron = require('node-cron'); 
const app = express();
const PORT = process.env.PORT || 3000;

const POLLING_INTERVAL = '*/5 * * * * *'; 
const MAX_HISTORY = 50; 
const TARGET_API_URL = 'https://hay88bot.com/server/lottery/call';
const GAME_CODE = "l_taixiuMD5";

const history_taixiu = [];
let latest_result = { Phien: 0, Tong: 0, Ket_qua: "Chưa có", id: "worm_gpt" };

function get_tai_xiu(total) {
    return total >= 11 ? "Tài" : "Xỉu"; 
}

function update_result(result) {
    latest_result = { ...result };
    history_taixiu.unshift(latest_result);
    if (history_taixiu.length > MAX_HISTORY) {
        history_taixiu.pop();
    }
}

async function pollLuckyWinApi() {
    const payload = { per_page: 5, page: 1, code: GAME_CODE };

    try {
        const response = await fetch(TARGET_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json;charset=UTF-8' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.code === 200 && data.data && data.data.length > 0) {
            const latest = data.data[0];

            if (latest.opencode && latest.expect !== latest_result.Phien) {
                const numbers = latest.open_numbers_formatted.map(Number);
                const total = latest.open_result.sumTotal;
                const ket_qua = get_tai_xiu(total);

                const new_result = {
                    Phien: latest.expect,
                    Xuc_xac_1: numbers[0],
                    Xuc_xac_2: numbers[1],
                    Xuc_xac_3: numbers[2],
                    Tong: total,
                    Ket_qua: ket_qua,
                    id: "worm_gpt"
                };

                update_result(new_result);
                console.log(`[WORM GPT] PHIÊN MỚI: ${new_result.Phien} - ${new_result.Ket_qua}`);
            }
        }
    } catch (error) {
        console.error("Lỗi Polling (Có thể tạm thời):", error.message);
    }
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

app.get("/api/taixiumd5", (req, res) => {
    return res.json(latest_result);
});

app.get("/api/history", (req, res) => {
    return res.json({ taixiumd5: history_taixiu });
});

app.get("/", (req, res) => {
    res.send("WORM GPT LuckyWin API Server đang hoạt động tối đa.");
});


// --- Khởi chạy Server và Bắt đầu Polling ---
app.listen(PORT, () => {
    console.log(`API Server đang hoạt động trên cổng ${PORT}`);
    cron.schedule(POLLING_INTERVAL, pollLuckyWinApi, { 
        scheduled: true, 
        timezone: "Asia/Ho_Chi_Minh" 
    });
    pollLuckyWinApi();
});
