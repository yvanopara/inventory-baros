import productModel from "../models/productModel.js";
import saleModel from "../models/saleModel.js";
import StockMovement from "../models/stockMovementModel.js";
import fs from "fs";
import cloudinary from "../config/cloudinary.js";
import { checkLowStock } from "./productController.js";

// --- Ajouter une vente ---
export const addSale = async (req, res) => {
  try {
    const { productId, variantSize, quantity, discount = 0, customerPhone, comment } = req.body;

    // 🔥 Correction majeure : forcer les nombres
    const qty = Number(quantity);
    const disc = Number(discount);

    if (isNaN(qty) || isNaN(disc)) {
      return res.status(400).json({ message: "Les valeurs doivent être des nombres." });
    }

    const product = await productModel.findById(productId);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });

    let unitPrice, costPrice;

    if (product.hasVariants) {
      const variant = product.sizes.find(v => v.size === variantSize);
      if (!variant) return res.status(404).json({ message: "Variante introuvable" });
      if (variant.stock < qty) return res.status(400).json({ message: "Stock insuffisant" });

      unitPrice = Number(variant.sellingPrice);
      costPrice = Number(variant.costPrice);

      variant.stock -= qty;
      variant.totalSold = Number(variant.totalSold) + qty;
      variant.lastSoldAt = new Date();
    } else {
      if (product.stock < qty) return res.status(400).json({ message: "Stock insuffisant" });

      unitPrice = Number(product.sellingPrice);
      costPrice = Number(product.costPrice);

      product.stock -= qty;
      product.totalSold = Number(product.totalSold) + qty;
      product.lastSoldAt = new Date();
    }

    // --- Calculs financiers ---
    const totalRevenue = unitPrice * qty;
    const totalCost = costPrice * qty;
    const finalPrice = totalRevenue - disc;
    const profit = finalPrice - totalCost;

    await product.save();

    // --- Upload de la preuve ---
    let proofImageUrl = null;
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "sales_proofs",
        resource_type: "image",
      });
      proofImageUrl = uploadResult.secure_url;
      fs.unlinkSync(req.file.path);
    }

    // --- Création de la vente ---
    const sale = new saleModel({
      productId: product._id,
      variantSize: variantSize || null,
      quantity: qty,
      sellingPrice: unitPrice,
      costPrice,
      discount: disc,
      totalCost,
      profit,
      productName: product.name,
      comment: comment || null,
      customerPhone: customerPhone || null,
      finalPrice,
      revenue: finalPrice,
      proofImage: proofImageUrl,
      status: "active",
    });

    await sale.save();

    // --- Historique du mouvement de stock ---
    await StockMovement.create({
      productId: product._id,
      productName: product.name,
      variantSize: variantSize || null,
      type: "sale",
      quantity: qty,
      note: "Vente enregistrée",
    });

    const alerts = checkLowStock(product);

    res.status(201).json({ message: "Vente enregistrée avec succès", sale, alerts });
  } catch (err) {
    console.error("Erreur dans addSale:", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};



// --- Annuler une vente ---
export const cancelSale = async (req, res) => {
  try {
    const { saleId } = req.params;

    const sale = await saleModel.findById(saleId);
    if (!sale) return res.status(404).json({ message: "Vente introuvable" });
    if (sale.status === "cancelled") return res.status(400).json({ message: "Vente déjà annulée" });

    const product = await productModel.findById(sale.productId);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });

    // Remettre le stock à jour
    if (product.hasVariants && sale.variantSize) {
      const variant = product.sizes.find(v => v.size === sale.variantSize);
      if (variant) {
        variant.stock += sale.quantity;
        variant.totalSold -= sale.quantity;
      }
    } else {
      product.stock += sale.quantity;
      product.totalSold -= sale.quantity;
    }

    await product.save();

    // Historique stock
    await StockMovement.create({
      productId: product._id,
      variantSize: sale.variantSize || null,
      type: "cancelSale",
      quantity: sale.quantity,
      note: "Vente annulée"
    });

    // Mettre les valeurs de la vente à zéro et marquer annulée
    sale.finalPrice = 0;
    sale.profit = 0;
    sale.totalCost = 0;
    sale.status = "cancelled";
    sale.cancelledAt = new Date();
    await sale.save();

    const alerts = checkLowStock(product);

    res.status(200).json({ message: "Vente annulée avec succès", sale, alerts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

// --- Réserver une commande ---
export const reserveSale = async (req, res) => {
  try {
    const { productId, variantSize, quantity, discount = 0, customerPhone, comment, deliveryDateTime } = req.body;


    // Vérifier que la date et l'heure de livraison sont fournies
    if (!deliveryDateTime) {
      return res.status(400).json({ message: "La date et l'heure de livraison sont obligatoires" });
    }

    const delivery = new Date(deliveryDateTime); // Accepte date + heure
    const now = new Date();
    if (delivery <= now) {
      return res.status(400).json({ message: "La date et l'heure de livraison doivent être postérieures à maintenant" });
    }

    const product = await productModel.findById(productId);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });

    let unitPrice, costPrice;

    if (product.hasVariants) {
      const variant = product.sizes.find(v => v.size === variantSize);
      if (!variant) return res.status(404).json({ message: "Variante introuvable" });
      if (variant.stock < quantity) return res.status(400).json({ message: "Stock insuffisant" });

      unitPrice = variant.sellingPrice;
      costPrice = variant.costPrice;
    } else {
      if (product.stock < quantity) return res.status(400).json({ message: "Stock insuffisant" });

      unitPrice = product.sellingPrice;
      costPrice = product.costPrice;
    }

    const finalPrice = (unitPrice - discount) * quantity;
    const profit = (unitPrice - costPrice - discount) * quantity;
    const totalCost = costPrice * quantity;

    const sale = new saleModel({
      productId: product._id,
      variantSize: variantSize || null,
      quantity,
      sellingPrice: unitPrice,
      costPrice,
      productName: product.name,
      discount,
      finalPrice,
      profit,
      totalCost,
      comment: comment || null,
      customerPhone: customerPhone || null,
      status: "reserved",
      isReserved: true,
      deliveryDate: delivery, // inclut maintenant l'heure
      reservedAt: new Date()
    });

    await sale.save();

    res.status(201).json({ message: "Commande réservée avec succès", sale });


  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};


export const deleteReservation = async (req, res) => {
  try {
    const { saleId } = req.params;

    if (!saleId) {
      return res.status(400).json({ message: "L'identifiant de la réservation est requis" });
    }

    const sale = await saleModel.findById(saleId);

    if (!sale) {
      return res.status(404).json({ message: "Réservation introuvable" });
    }

    if (sale.status !== "reserved") {
      return res.status(400).json({ message: "Seules les réservations peuvent être supprimées" });
    }

    await sale.deleteOne();

    res.status(200).json({ message: "Réservation supprimée avec succès" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};


// --- Marquer une commande réservée comme livrée ---
export const deliverSale = async (req, res) => {
  try {
    const { saleId } = req.params;

    const sale = await saleModel.findById(saleId);
    if (!sale) return res.status(404).json({ message: "Commande introuvable" });
    if (sale.status !== "reserved")
      return res.status(400).json({ message: "Cette commande n'est pas en attente de livraison" });

    const product = await productModel.findById(sale.productId);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });

    if (product.hasVariants && sale.variantSize) {
      const variant = product.sizes.find(v => v.size === sale.variantSize);
      if (!variant || variant.stock < sale.quantity) {
        return res.status(400).json({ message: "Stock insuffisant pour livrer" });
      }
      variant.stock -= sale.quantity;
      variant.totalSold += sale.quantity;
    } else {
      if (product.stock < sale.quantity) {
        return res.status(400).json({ message: "Stock insuffisant pour livrer" });
      }
      product.stock -= sale.quantity;
      product.totalSold += sale.quantity;
    }

    await product.save();

    sale.status = "active";
    sale.lastUpdated = new Date();

    // 👉 Changer la date pour la date du jour de livraison
    sale.createdAt = new Date();

    await sale.save();

    await StockMovement.create({
      productId: product._id,
      productName: product.name,
      variantSize: sale.variantSize || null,
      type: "delivery",
      quantity: sale.quantity,
      note: "Commande livrée et activée"
    });

    res.status(200).json({ message: "Commande livrée et activée avec succès", sale });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};


// --- Résumés ---
const computeSummary = (sales) => {
  let totalQuantity = 0, totalRevenue = 0, totalProfit = 0, totalCost = 0;
  sales.forEach(sale => {
    totalQuantity += sale.quantity;
    totalRevenue += sale.finalPrice || 0;
    totalProfit += sale.profit || 0;
    totalCost += sale.totalCost || 0;
  });
  return { totalQuantity, totalRevenue, totalProfit, totalCost };
};


// Daily summary
export const gettDailySummary = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const sales = await saleModel
      .find({ createdAt: { $gte: start, $lte: end }, status: "active" })
      .populate("productId", "name image")
      .sort({ createdAt: -1 });

    const dailySales = sales.map((sale) => ({
      productPhoto: sale.productId?.image || "",
      productName: sale.productName || sale.productId?.name,
      quantity: sale.quantity,
      comment: sale.comment || "",
      proofImage: sale.proofImage || "",
      customerPhone: sale.customerPhone || "",
      date: sale.createdAt,
      discount: sale.discount || 0,
      revenue: sale.finalPrice || 0,
      profit: sale.profit || 0,
      cost: sale.totalCost || 0,
    }));

    const computeSummary = (sales) => {
      let totalQuantity = 0, totalRevenue = 0, totalProfit = 0, totalCost = 0;
      sales.forEach(sale => {
        totalQuantity += sale.quantity || 0;
        totalRevenue += sale.revenue || 0;
        totalProfit += sale.profit || 0;
        totalCost += sale.cost || 0;
      });
      return { totalQuantity, totalRevenue, totalProfit, totalCost };
    };

    const summary = computeSummary(dailySales);

    return res.status(200).json({
      date: new Date().toLocaleDateString("fr-FR"),
      sales: dailySales,
      summary,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

//2 --- Daily Summary ---
export const getDailySummary = async (req, res, internal = false) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const sales = await saleModel
      .find({ createdAt: { $gte: start, $lte: end }, status: "active" })
      .populate("productId", "name image")
      .sort({ createdAt: -1 });

    const dailySales = sales.map((sale) => ({
      productPhoto: sale.productId?.image || "",
      productName: sale.productName || sale.productId?.name,
      quantity: sale.quantity,
      comment: sale.comment || "",
      proofImage: sale.proofImage || "",
      customerPhone: sale.customerPhone || "",
      date: sale.createdAt,
      discount: sale.discount || 0,
      revenue: sale.finalPrice || 0,
      profit: sale.profit || 0,
      cost: sale.totalCost || 0,
    }));

    const computeSummary = (sales) => {
      let totalQuantity = 0, totalRevenue = 0, totalProfit = 0, totalCost = 0;
      sales.forEach(sale => {
        totalQuantity += sale.quantity || 0;
        totalRevenue += sale.revenue || 0;
        totalProfit += sale.profit || 0;
        totalCost += sale.cost || 0;
      });
      return { totalQuantity, totalRevenue, totalProfit, totalCost };
    };

    const summary = computeSummary(dailySales);

    // 👉 IMPORTANT : retour CRON AVANT res.json()
    if (internal) {
      return { summary, sales: dailySales };
    }

    // 👉 Réponse API normale
    return res.status(200).json({
      date: new Date().toLocaleDateString("fr-FR"),
      sales: dailySales,
      summary,
    });

  } catch (err) {
    console.error(err);
    if (!internal) {
      return res.status(500).json({ message: "Erreur serveur", error: err.message });
    } else {
      return { error: err.message };
    }
  }
};

// weekly summary
export const gettWeeklySummary = async (req, res) => {
  try {
    const now = new Date();

    // Début semaine = Lundi
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1);
    start.setHours(0, 0, 0, 0);

    // Fin semaine = Dimanche
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    // Base des jours VIDE pour ton front-end
    const days = {
      "Lundi": [],
      "Mardi": [],
      "Mercredi": [],
      "Jeudi": [],
      "Vendredi": [],
      "Samedi": [],
      "Dimanche": []
    };

    // Récupérer les ventes
    const sales = await saleModel
      .find({ createdAt: { $gte: start, $lte: end }, status: "active" })
      .populate("productId", "name image")
      .sort({ createdAt: 1 });

    // Répartition par jour
    sales.forEach((sale) => {
      const d = new Date(sale.createdAt);
      const dayName = d.toLocaleDateString('fr-FR', { weekday: 'long' });

      const normalizedDay =
        dayName.charAt(0).toUpperCase() + dayName.slice(1); // "lundi" → "Lundi"

      const saleData = {
        productPhoto: sale?.productId?.image || "",
        productName: sale?.productName || sale?.productId?.name || "Produit inconnu",
        quantity: sale?.quantity ?? 0,
        comment: sale?.comment || "",
        proofImage: sale?.proofImage || "",
        customerPhone: sale?.customerPhone || "",
        date: sale?.createdAt,
        discount: sale?.discount || 0,
        revenue: sale?.finalPrice || 0,
        profit: sale?.profit || 0,
        cost: sale?.totalCost || 0,
      };

      if (days[normalizedDay]) {
        days[normalizedDay].push(saleData);
      }
    });

    // Calcul summary
    const summary = Object.values(days).flat().reduce(
      (acc, sale) => {
        acc.totalQuantity += sale.quantity;
        acc.totalRevenue += sale.revenue;
        acc.totalProfit += sale.profit;
        acc.totalCost += sale.cost;
        return acc;
      },
      {
        totalQuantity: 0,
        totalRevenue: 0,
        totalProfit: 0,
        totalCost: 0,
      }
    );

    return res.status(200).json({
      startDate: start,
      endDate: end,
      dailySales: days,   // IMPORTANT ! c’est ce que ton front attend
      summary,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Erreur serveur",
      error: err.message,
      dailySales: {},
      summary: {}
    });
  }
};





// 2 --- Weekly Summary ---
export const getWeeklySummary = async (req, res, internal = false) => {
  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1); // Lundi
    start.setHours(0, 0, 0, 0);


    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Dimanche
    end.setHours(23, 59, 59, 999);

    const sales = await saleModel
      .find({ createdAt: { $gte: start, $lte: end }, status: "active" })
      .populate("productId", "name image")
      .sort({ createdAt: 1 });

    const dailySales = sales.map((sale) => ({
      productPhoto: sale.productId?.image || "",
      productName: sale.productName || sale.productId?.name || "Produit inconnu",
      quantity: sale.quantity,
      comment: sale.comment || "",
      proofImage: sale.proofImage || "",
      customerPhone: sale.customerPhone || "",
      date: sale.createdAt,
      discount: sale.discount || 0,
      revenue: sale.finalPrice || 0,
      profit: sale.profit || 0,
      cost: sale.totalCost || 0,
    }));

    const computeSummary = (salesArray) => {
      let totalQuantity = 0, totalRevenue = 0, totalProfit = 0, totalCost = 0;
      salesArray.forEach((sale) => {
        totalQuantity += sale.quantity || 0;
        totalRevenue += sale.revenue || 0;
        totalProfit += sale.profit || 0;
        totalCost += sale.cost || 0;
      });
      return { totalQuantity, totalRevenue, totalProfit, totalCost };
    };

    const summary = computeSummary(dailySales);

    if (internal) {
      return { summary, sales: dailySales };
    }

    res.status(200).json({
      startDate: start,
      endDate: end,
      sales: dailySales,
      summary,
    });


  } catch (err) {
    console.error(err);
    if (!internal) {
      return res.status(500).json({ message: "Erreur serveur", error: err.message });
    } else {
      return { error: err.message };
    }
  }
};


// --- Monthly Summary ---
export const gettMonthlySummary = async (req, res) => {
  try {
    const now = new Date();

    // Début et fin du mois
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);

    // Récupération des ventes actives du mois
    const sales = await saleModel
      .find({ createdAt: { $gte: start, $lte: end }, status: "active" })
      .populate("productId", "name image")
      .sort({ createdAt: 1 });

      
    // Formatage des ventes
    const formattedSales = sales.map((sale) => ({
      productPhoto: sale.productId?.image || "",
      productName: sale.productName || sale.productId?.name || "Produit inconnu",
      quantity: sale.quantity,
      revenue: sale.finalPrice || 0,
      profit: sale.profit || 0,
      cost: sale.totalCost || 0,
      proofImage: sale.proofImage || "",
      status: sale.status || "",
      date: sale.createdAt,

      // ✅ Nouveaux champs
      customerPhone: sale.customerPhone || "",
      comment: sale.comment || "",
    }));

    // Génération des jours du mois (pour remplir weeklySummaries)
    const daysInMonth = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      const daySales = formattedSales.filter(
        (sale) =>
          new Date(sale.date).toDateString() === date.toDateString()
      );

      daysInMonth.push({
        date,
        sales: daySales,
      });
    }

    // Transformer le mois en semaines (comme ton frontend l'attend)
    const weeklySummaries = [];
    let currentWeek = [];

    daysInMonth.forEach((day) => {
      if (currentWeek.length === 0) {
        currentWeek.push(day);
      } else {
        const lastDay = currentWeek[currentWeek.length - 1].date;
        const diff = (day.date - lastDay) / (1000 * 60 * 60 * 24);

        // Nouvelle semaine si on change de lundi ou si >1 jour de saut
        if (day.date.getDay() === 1 || diff > 1) {
          weeklySummaries.push({ days: currentWeek });
          currentWeek = [day];
        } else {
          currentWeek.push(day);
        }
      }
    });

    if (currentWeek.length > 0) weeklySummaries.push({ days: currentWeek });

    // Résumé total (global)
    const totalSummary = formattedSales.reduce(
      (acc, sale) => {
        acc.totalQuantity += sale.quantity || 0;
        acc.totalRevenue += sale.revenue || 0;
        acc.totalProfit += sale.profit || 0;
        acc.totalCost += sale.cost || 0;
        return acc;
      },
      { totalQuantity: 0, totalRevenue: 0, totalProfit: 0, totalCost: 0 }
    );

    return res.status(200).json({
      month: now.toLocaleString("fr-FR", { month: "long" }),
      year: now.getFullYear(),
      totalSummary,
      weeklySummaries,
    });

  } catch (err) {
    console.error("Erreur dans getMonthlySummary :", err);
    return res.status(500).json({
      message: "Erreur serveur",
      error: err.message,
    });
  }
};





// --- Yearly Summary ---
// --- Yearly Summary avec détails des ventes ---
export const getYearlySummary = async (req, res) => {
  try {
    const now = new Date();
    const year = req.query.year ? parseInt(req.query.year) : now.getFullYear();

    const start = new Date(year, 0, 1); // 1er janvier
    start.setHours(0, 0, 0, 0);
    const end = new Date(year, 11, 31); // 31 décembre
    end.setHours(23, 59, 59, 999);

    // Récupérer toutes les ventes actives de l'année
    const sales = await saleModel
      .find({ createdAt: { $gte: start, $lte: end }, status: "active" })
      .populate("productId", "name image")
      .sort({ createdAt: 1 });

    if (!sales.length) {
      return res.status(200).json({
        message: `Aucune vente enregistrée pour l'année ${year}.`,
        year,
        monthlySummaries: [],
        totalSummary: { totalQuantity: 0, totalRevenue: 0, totalProfit: 0, totalCost: 0 },
        yearlySales: [],
      });
    }

    // --- Fonction utilitaire pour résumer un tableau de ventes ---
    const computeSummary = (salesArray) => {
      let totalQuantity = 0,
        totalRevenue = 0,
        totalProfit = 0,
        totalCost = 0;
      salesArray.forEach((sale) => {
        totalQuantity += sale.quantity || 0;
        totalRevenue += sale.finalPrice || 0;
        totalProfit += sale.profit || 0;
        totalCost += sale.totalCost || 0;
      });
      return { totalQuantity, totalRevenue, totalProfit, totalCost };
    };

    // --- Construire les détails des ventes individuelles ---
    const yearlySales = sales.map((sale) => ({
      saleId: sale._id,
      productPhoto: sale.productId?.image || "",
      productName: sale.productName || sale.productId?.name || "Produit inconnu",
      quantity: sale.quantity,
      sellingPrice: sale.sellingPrice || 0,
      costPrice: sale.costPrice || 0,
      discount: sale.discount || 0,
      finalPrice: sale.finalPrice || 0,
      profit: sale.profit || 0,
      totalCost: sale.totalCost || 0,
      variantSize: sale.variantSize || null,
      customerPhone: sale.customerPhone || "",
      comment: sale.comment || "",
      proofImage: sale.proofImage || "",
      status: sale.status,
      date: sale.createdAt,
    }));

    // --- Regrouper par mois pour le résumé mensuel ---
    const monthlyData = {};
    sales.forEach((sale) => {
      const monthKey = new Date(sale.createdAt).getMonth(); // 0 = janvier
      if (!monthlyData[monthKey]) monthlyData[monthKey] = [];
      monthlyData[monthKey].push(sale);
    });

    const monthlySummaries = [];
    for (let m = 0; m < 12; m++) {
      const monthSales = monthlyData[m] || [];
      const summary = computeSummary(monthSales);
      monthlySummaries.push({
        month: new Date(year, m).toLocaleString("fr-FR", { month: "long" }),
        summary,
        numberOfSales: monthSales.length,
      });
    }

    // --- Résumé total de l'année ---
    const totalSummary = computeSummary(sales);

    res.status(200).json({
      year,
      totalSummary,
      monthlySummaries,
      yearlySales, // Détails de toutes les ventes
    });
  } catch (err) {
    console.error("Erreur dans getYearlySummary :", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};



// --- Obtenir toutes les ventes ---
export const getAllSales = async (req, res) => {
  try {
    const sales = await saleModel.find();
    res.status(200).json(sales);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};

// --- Obtenir les ventes réservées ---
export const getReservedSales = async (req, res) => {
  try {
    const reservedSales = await saleModel
      .find({ status: "reserved" })
      .populate("productId", "name")
      .sort({ reservedAt: -1 });

    // 👉 Ne pas renvoyer 404 si aucune réservation
    return res.status(200).json({
      success: true,
      count: reservedSales.length,
      reservedSales,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur",
      error: err.message,
    });
  }
};




// --- Résumé global pour toutes les périodes (totaux seulement) ---
export const getSalesSummaryDashboard = async (req, res) => {
  try {
    const now = new Date();

    // Fonction utilitaire pour calculer résumé
    const computeSummary = (sales) => {
      let totalQuantity = 0, totalRevenue = 0, totalProfit = 0, totalCost = 0;
      sales.forEach(sale => {
        totalQuantity += sale.quantity || 0;
        totalRevenue += sale.finalPrice || 0;
        totalProfit += sale.profit || 0;
        totalCost += sale.totalCost || 0;
      });
      return { totalQuantity, totalRevenue, totalProfit, totalCost };
    };

    // --- Définition des périodes ---
    const periods = {
      today: { start: new Date(), end: new Date() },
      yesterday: { start: new Date(), end: new Date() },
      thisWeek: { start: new Date(), end: new Date() },
      lastWeek: { start: new Date(), end: new Date() },
      thisMonth: { start: new Date(), end: new Date() },
      lastMonth: { start: new Date(), end: new Date() },
      thisYear: { start: new Date(), end: new Date() },
      lastYear: { start: new Date(), end: new Date() },
    };

    // --- Jour ---
    periods.today.start.setHours(0, 0, 0, 0);
    periods.today.end.setHours(23, 59, 59, 999);

    periods.yesterday.start.setDate(now.getDate() - 1);
    periods.yesterday.start.setHours(0, 0, 0, 0);
    periods.yesterday.end.setDate(now.getDate() - 1);
    periods.yesterday.end.setHours(23, 59, 59, 999);

    // --- Semaine en cours ---
    periods.thisWeek.start.setDate(now.getDate() - now.getDay() + 1); // lundi
    periods.thisWeek.start.setHours(0, 0, 0, 0);
    periods.thisWeek.end.setDate(periods.thisWeek.start.getDate() + 6); // dimanche
    periods.thisWeek.end.setHours(23, 59, 59, 999);

    // --- Semaine dernière ---
    periods.lastWeek.start.setDate(periods.thisWeek.start.getDate() - 7);
    periods.lastWeek.start.setHours(0, 0, 0, 0);
    periods.lastWeek.end.setDate(periods.lastWeek.start.getDate() + 6);
    periods.lastWeek.end.setHours(23, 59, 59, 999);

    // --- Mois en cours ---
    periods.thisMonth.start = new Date(now.getFullYear(), now.getMonth(), 1);
    periods.thisMonth.start.setHours(0, 0, 0, 0);
    periods.thisMonth.end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    periods.thisMonth.end.setHours(23, 59, 59, 999);

    // --- Mois passé ---
    periods.lastMonth.start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    periods.lastMonth.start.setHours(0, 0, 0, 0);
    periods.lastMonth.end = new Date(now.getFullYear(), now.getMonth(), 0);
    periods.lastMonth.end.setHours(23, 59, 59, 999);

    // --- Année en cours ---
    periods.thisYear.start = new Date(now.getFullYear(), 0, 1);
    periods.thisYear.start.setHours(0, 0, 0, 0);
    periods.thisYear.end = new Date(now.getFullYear(), 11, 31);
    periods.thisYear.end.setHours(23, 59, 59, 999);

    // --- Année passée ---
    const lastYear = now.getFullYear() - 1;
    periods.lastYear.start = new Date(lastYear, 0, 1);
    periods.lastYear.start.setHours(0, 0, 0, 0);
    periods.lastYear.end = new Date(lastYear, 11, 31);
    periods.lastYear.end.setHours(23, 59, 59, 999);

    // --- Calcul des totaux pour chaque période ---
    const results = {};
    for (const [key, period] of Object.entries(periods)) {
      const sales = await saleModel.find({
        createdAt: { $gte: period.start, $lte: period.end },
        status: "active",
      });
      results[key] = computeSummary(sales);
    }

    res.status(200).json({
      date: now.toLocaleDateString("fr-FR"),
      summary: results,
    });

  } catch (err) {
    console.error("Erreur dans getSalesSummary :", err);
    res.status(500).json({ message: "Erreur serveur", error: err.message });
  }
};



// --- Fonction utilitaire pour top/low produits ---
const getTopOrLowProducts = async (startDate, endDate, order) => {
  return await saleModel.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: "active",
      },
    },
    {
      $group: {
        _id: "$productId",
        totalQuantity: { $sum: "$quantity" },
      },
    },
    { $sort: { totalQuantity: order } }, // -1 top, 1 low
    { $limit: 5 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    {
      $project: {
        _id: 0,
        productId: "$product._id",
        name: "$product.name",
        image: "$product.image",
        totalQuantity: 1,
      },
    },
  ]);
};

// --- Contrôleur principal ---
export const getTopAndLowSellingProducts = async (req, res) => {
  try {
    const now = new Date();

    // --- Semaines ---
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // lundi
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
    endOfLastWeek.setHours(23, 59, 59, 999);

    // --- Mois ---
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    endOfLastMonth.setHours(23, 59, 59, 999);

    // --- Appels parallèles ---
    const [
      weeklyTop,
      weeklyLow,
      lastWeekTop,
      lastWeekLow,
      monthlyTop,
      monthlyLow,
      lastMonthTop,
      lastMonthLow
    ] = await Promise.all([
      getTopOrLowProducts(startOfWeek, endOfWeek, -1),
      getTopOrLowProducts(startOfWeek, endOfWeek, 1),
      getTopOrLowProducts(startOfLastWeek, endOfLastWeek, -1),
      getTopOrLowProducts(startOfLastWeek, endOfLastWeek, 1),
      getTopOrLowProducts(startOfMonth, endOfMonth, -1),
      getTopOrLowProducts(startOfMonth, endOfMonth, 1),
      getTopOrLowProducts(startOfLastMonth, endOfLastMonth, -1),
      getTopOrLowProducts(startOfLastMonth, endOfLastMonth, 1),
    ]);

    res.json({
      weeklyTop,
      weeklyLow,
      lastWeekTop,
      lastWeekLow,
      monthlyTop,
      monthlyLow,
      lastMonthTop,
      lastMonthLow
    });

  } catch (error) {
    console.error("Erreur top/low ventes avancé:", error);
    res.status(500).json({ message: "Erreur lors du calcul des ventes" });
  }
};
























// getMonthlySummaryForCrons
export const getMonthlySummaryForCron = async () => {
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);

    const sales = await saleModel
      .find({ createdAt: { $gte: start, $lte: end }, status: "active" })
      .populate("productId", "name image")
      .sort({ createdAt: 1 });

    const monthlySales = sales.map((sale) => ({
      productPhoto: sale.productId?.image || "",
      productName: sale.productName || sale.productId?.name || "Produit inconnu",
      quantity: sale.quantity,
      proofImage: sale.proofImage || "",
      revenue: sale.finalPrice || 0,
      profit: sale.profit || 0,
      cost: sale.totalCost || 0,
      status: sale.status || "",
      date: sale.createdAt,
      customerPhone: sale.customerPhone || "",
    }));

    const computeSummary = (salesArray) => {
      let totalQuantity = 0, totalRevenue = 0, totalProfit = 0, totalCost = 0;
      salesArray.forEach((sale) => {
        totalQuantity += sale.quantity || 0;
        totalRevenue += sale.revenue || 0;
        totalProfit += sale.profit || 0;
        totalCost += sale.cost || 0;
      });
      return { totalQuantity, totalRevenue, totalProfit, totalCost };
    };

    const summary = computeSummary(monthlySales);
    return { summary, sales: monthlySales };

  } catch (err) {
    console.error("Erreur dans getMonthlySummaryForCron :", err);
    return { summary: null, sales: [] };
  }
};

