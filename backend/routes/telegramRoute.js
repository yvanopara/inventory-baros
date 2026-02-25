import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { getDailySummary } from "../controllers/salesController.js";

const router = express.Router();
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

router.get("/test/daily", async (req, res) => {
  try {
    const { summary } = await getDailySummary(null, null, true);
    const msg = `📊 Résumé Quotidien\n📦 Quantité totale vendue: ${summary.totalQuantity}\n💰 Chiffre d’affaires: ${summary.totalRevenue}\n💸 Coût total: ${summary.totalCost}\n📈 Profit total: ${summary.totalProfit}`;
    await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, msg);
    res.json({ status: "ok", summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
