import React, { useEffect, useState } from "react";
import { api } from "../../../api/api";
import "./MonthlySummary.css";

const MonthlySummaryTable = () => {
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());

  useEffect(() => {
    const fetchMonthlySummary = async () => {
      try {
        setLoading(true);
        const res = await api.get("/api/sales/summary/monthly");
        setSummaryData(res.data);
      } catch (err) {
        console.error(err);
        setError("Erreur lors du chargement du résumé mensuel.");
      } finally {
        setLoading(false);
      }
    };

    fetchMonthlySummary();
  }, []);

  const toggleWeek = (weekIndex) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekIndex)) {
      newExpanded.delete(weekIndex);
    } else {
      newExpanded.add(weekIndex);
    }
    setExpandedWeeks(newExpanded);
  };

  const openImageModal = (imageUrl) => {
    setSelectedImage(imageUrl);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('fr-FR') + ' FCFA';
  };

  const getWeekColor = (weekIndex) => {
    const colors = [
      "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
      "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"
    ];
    return colors[weekIndex % colors.length];
  };

  if (loading) {
    return (
      <div className="ms-container">
        <div className="ms-loading">
          <div className="ms-spinner"></div>
          <p>Chargement du résumé mensuel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ms-container">
        <div className="ms-error-container">
          <div className="ms-error">
            <span className="ms-error-icon">⚠️</span>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!summaryData) return null;

  return (
    <div className="ms-container">
      {/* Header */}
      <div className="ms-header">
        <div className="ms-header-content">
          <h2>Résumé Mensuel des Ventes</h2>
          <p className="ms-subtitle">
            Aperçu complet des performances commerciales ce mois
          </p>
        </div>
        <div className="ms-period-badge">
          {summaryData.month} {summaryData.year}
        </div>
      </div>

      {/* Cartes de statistiques principales */}
      <div className="ms-stats-grid">
        <div className="ms-stat-card ms-card-primary">
          <div className="ms-stat-icon">📦</div>
          <div className="ms-stat-content">
            <div className="ms-stat-value">{summaryData.totalSummary.totalQuantity || 0}</div>
            <div className="ms-stat-label">Total des Ventes</div>
            <div className="ms-stat-subtitle">unités vendues</div>
          </div>
        </div>

        <div className="ms-stat-card ms-card-success">
          <div className="ms-stat-icon">💰</div>
          <div className="ms-stat-content">
            <div className="ms-stat-value">
              {formatCurrency(summaryData.totalSummary.totalRevenue)}
            </div>
            <div className="ms-stat-label">Chiffre d'Affaires</div>
            <div className="ms-stat-subtitle">revenu total</div>
          </div>
        </div>

        <div className="ms-stat-card ms-card-profit">
          <div className="ms-stat-icon">📈</div>
          <div className="ms-stat-content">
            <div className="ms-stat-value">
              {formatCurrency(summaryData.totalSummary.totalProfit)}
            </div>
            <div className="ms-stat-label">Profit Net</div>
            <div className="ms-stat-subtitle">bénéfice réalisé</div>
          </div>
        </div>

        <div className="ms-stat-card ms-card-warning">
          <div className="ms-stat-icon">💸</div>
          <div className="ms-stat-content">
            <div className="ms-stat-value">
              {formatCurrency(summaryData.totalSummary.totalCost)}
            </div>
            <div className="ms-stat-label">Coût Total</div>
            <div className="ms-stat-subtitle">coût des marchandises</div>
          </div>
        </div>
      </div>

      {/* Indicateurs de performance */}
      {summaryData.totalSummary.totalRevenue > 0 && (
        <div className="ms-performance">
          <div className="ms-performance-item">
            <span className="ms-performance-label">Marge bénéficiaire :</span>
            <span className="ms-performance-value">
              {((summaryData.totalSummary.totalProfit / summaryData.totalSummary.totalRevenue) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="ms-performance-item">
            <span className="ms-performance-label">Vente moyenne :</span>
            <span className="ms-performance-value">
              {formatCurrency(summaryData.totalSummary.totalRevenue / (summaryData.totalSummary.totalQuantity || 1))}
            </span>
          </div>
          <div className="ms-performance-item">
            <span className="ms-performance-label">Semaines actives :</span>
            <span className="ms-performance-value">
              {summaryData.weeklySummaries.filter(week =>
                week.days.some(day => day.sales.length > 0)
              ).length}
            </span>
          </div>
        </div>
      )}

      {/* Résumé par semaine */}
      <div className="ms-weeks-container">
        {summaryData.weeklySummaries.map((week, weekIndex) => {
          const weekSales = week.days.flatMap(day => day.sales);
          const weekTotals = weekSales.reduce((acc, sale) => ({
            quantity: acc.quantity + sale.quantity,
            revenue: acc.revenue + sale.revenue,
            profit: acc.profit + sale.profit,
            cost: acc.cost + sale.cost,
          }), { quantity: 0, revenue: 0, profit: 0, cost: 0 });

          const weekColor = getWeekColor(weekIndex);
          const isExpanded = expandedWeeks.has(weekIndex);

          if (weekSales.length === 0) return null;

          return (
            <div key={weekIndex} className="ms-week-section">
              {/* En-tête de semaine */}
              <div
                className="ms-week-header"
                onClick={() => toggleWeek(weekIndex)}
                style={{ borderLeftColor: weekColor }}
              >
                <div className="ms-week-title-container">
                  <h3 className="ms-week-title">Semaine {weekIndex + 1}</h3>
                  <div className="ms-sales-count">
                    <span className="ms-count-badge" style={{ backgroundColor: weekColor }}>
                      {weekSales.length}
                    </span>
                    vente(s) cette semaine
                  </div>
                </div>
                <div className="ms-week-toggle">
                  {isExpanded ? '▼' : '▶'}
                </div>
              </div>

              {/* Contenu de la semaine (expandable) */}
              {isExpanded && (
                <div className="ms-week-content">
                  <div className="ms-table-container">
                    <div className="ms-table-scroll">
                      <table className="ms-sales-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Produit</th>
                            <th>Photo</th>
                            <th>Qté</th>
                            <th>Prix</th>
                            <th>Profit</th>
                            <th>Coût</th>
                            <th>Contact</th>
                            <th>Commentaire</th>
                            <th>Preuve</th>
                            <th>Heure</th>
                          </tr>
                        </thead>
                        <tbody>
                          {week.days.flatMap((day, dayIndex) =>
                            day.sales.map((sale, saleIndex) => {
                              return (
                                <tr
                                  key={`${weekIndex}-${dayIndex}-${saleIndex}`}
                                  className={saleIndex % 2 === 0 ? "ms-even-row" : "ms-odd-row"}
                                >
                                  <td className="ms-date-cell">
                                    {new Date(day.date).toLocaleDateString("fr-FR", {
                                      weekday: 'short',
                                      day: 'numeric',
                                      month: 'short'
                                    })}
                                  </td>
                                  <td className="ms-product-cell">
                                    <span className="ms-product-name">
                                      {sale.productName || "Inconnu"}
                                    </span>
                                  </td>
                                  <td>
                                    {sale.productPhoto ? (
                                      <img
                                        src={sale.productPhoto}
                                        alt="Produit"
                                        className="ms-product-image"
                                        onClick={() => openImageModal(sale.productPhoto)}
                                      />
                                    ) : (
                                      <div className="ms-no-image">
                                        <span>📷</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="ms-quantity-cell">
                                    <span className="ms-quantity-badge">
                                      {sale.quantity}
                                    </span>
                                  </td>
                                  <td className="ms-revenue-cell">
                                    {formatCurrency(sale.revenue)}
                                  </td>
                                  <td className="ms-profit-cell">
                                    {formatCurrency(sale.profit)}
                                  </td>
                                  <td className="ms-cost-cell">
                                    {formatCurrency(sale.cost)}
                                  </td>
                                  <td className="ms-phone-cell">
                                    {sale.customerPhone ? (
                                      <a 
                                        href={`https://wa.me/237${sale.customerPhone.replace(/\s+/g, '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ms-whatsapp-link"
                                        title="Contacter sur WhatsApp"
                                      >
                                        <span className="ms-whatsapp-icon">📱</span>
                                        {sale.customerPhone}
                                      </a>
                                    ) : (
                                      <span className="ms-no-phone">-</span>
                                    )}
                                  </td>
                                  <td className="ms-comment-cell">
                                    <div className="ms-comment-content">
                                      {sale.comment ? (
                                        <span className="ms-comment-text">
                                          {sale.comment}
                                        </span>
                                      ) : (
                                        <span className="ms-no-comment">-</span>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    {sale.proofImage ? (
                                      <img
                                        src={sale.proofImage}
                                        alt="Preuve"
                                        className="ms-proof-image"
                                        onClick={() => openImageModal(sale.proofImage)}
                                      />
                                    ) : (
                                      <div className="ms-no-proof">
                                        <span>📄</span>
                                      </div>
                                    )}
                                  </td>
                                  <td className="ms-time-cell">
                                    {new Date(sale.date).toLocaleTimeString("fr-FR", {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totaux de la semaine */}
                  <div className="ms-week-totals" style={{ borderLeftColor: weekColor }}>
                    <div className="ms-total-item">
                      <span className="ms-total-label">Total Quantité :</span>
                      <span className="ms-total-value">{weekTotals.quantity}</span>
                    </div>
                    <div className="ms-total-item">
                      <span className="ms-total-label">Total Ventes :</span>
                      <span className="ms-total-value">{formatCurrency(weekTotals.revenue)}</span>
                    </div>
                    <div className="ms-total-item">
                      <span className="ms-total-label">Total Profit :</span>
                      <span className="ms-total-value ms-profit-highlight">
                        {formatCurrency(weekTotals.profit)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* État vide */}
      {summaryData.weeklySummaries.every(week =>
        week.days.every(day => day.sales.length === 0)
      ) && (
        <div className="ms-empty-state">
          <div className="ms-empty-icon">📊</div>
          <h3>Aucune vente ce mois-ci</h3>
          <p>Les ventes du mois apparaîtront ici.</p>
        </div>
      )}

      {/* Modal pour les images */}
      {selectedImage && (
        <div className="ms-image-modal" onClick={closeImageModal}>
          <div className="ms-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="ms-modal-close" onClick={closeImageModal}>×</button>
            <img src={selectedImage} alt="Agrandissement" className="ms-modal-image" />
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlySummaryTable;



// import React, { useEffect, useState } from "react";
// import { api } from "../../../api/api"; // ← chemin corrigé
// import "./MonthlySummary.css";

// const MonthlySummaryTable = () => {
//   const [summaryData, setSummaryData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   useEffect(() => {
//     const fetchMonthlySummary = async () => {
//       try {
//         const res = await api.get("/api/sales/summary/monthly"); // URL relative
//         setSummaryData(res.data);
//       } catch (err) {
//         console.error(err);
//         setError("Erreur lors du chargement du résumé mensuel.");
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchMonthlySummary();
//   }, []);

//   if (loading) return <p className="loading">Chargement...</p>;
//   if (error) return <p className="error">{error}</p>;
//   if (!summaryData) return null;

//   // Fusionner toutes les ventes du mois
//   const allSales = summaryData.weeklySummaries.flatMap((week) =>
//     week.days.flatMap((day) =>
//       day.sales.map((sale) => ({
//         ...sale,
//         date: day.date,
//       }))
//     )
//   );

//   return (
//     <div className="monthly-table-container">
//       <h2>
//         Résumé mensuel – {summaryData.month} {summaryData.year}
//       </h2>

//       <div className="month-total">
//         <p>
//           <b>Total Quantité :</b> {summaryData.totalSummary.totalQuantity || 0}
//         </p>
//         <p>
//           <b>Chiffre d’affaires :</b>{" "}
//           {summaryData.totalSummary.totalRevenue || 0} FCFA
//         </p>
//         <p>
//           <b>Bénéfice :</b> {summaryData.totalSummary.totalProfit || 0} FCFA
//         </p>
//         <p>
//           <b>Coût total :</b> {summaryData.totalSummary.totalCost || 0} FCFA
//         </p>
//       </div>

//       <table className="monthly-table">
//         <thead>
//           <tr>
//             <th>Date</th>
//             <th>Produit</th>
//             <th>Image Produit</th>
//             <th>Preuve</th>
//             <th>Quantité</th>
//             <th>Montant</th>
//             <th>Bénéfice</th>
//             <th>Statut</th>
//           </tr>
//         </thead>
//         <tbody>
//           {allSales.map((sale, index) => (
//             <tr key={index}>
//               <td>{new Date(sale.date).toLocaleDateString("fr-FR")}</td>
//               <td>{sale.productName || "Inconnu"}</td>
//               <td>
//                 {sale.productPhoto ? (
//                   <img
//                     src={sale.productPhoto}
//                     alt="Produit"
//                     className="product-image"
//                   />
//                 ) : (
//                   <span className="no-image">-</span>
//                 )}
//               </td>
//               <td>
//                 {sale.proofImage ? (
//                   <img
//                     src={sale.proofImage}
//                     alt="Preuve"
//                     className="proof-image"
//                   />
//                 ) : (
//                   <span className="no-image">-</span>
//                 )}
//               </td>
//               <td>{sale.quantity}</td>
//               <td>{sale.revenue} FCFA</td>
//               <td>{sale.profit} FCFA</td>
//               <td>{sale.status || "active"}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   );
// };

// export default MonthlySummaryTable;
