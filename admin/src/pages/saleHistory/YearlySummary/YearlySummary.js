// YearlySummary.jsx
import React, { useEffect, useState } from "react";
import { api } from "../../../api/api";
import "./YearlySummary.css";

const YearlySummary = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [monthlySummaries, setMonthlySummaries] = useState([]);
  const [totalSummary, setTotalSummary] = useState({
    totalQuantity: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalCost: 0
  });
  const [yearlySales, setYearlySales] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);

  // Générer les années de 2024 jusqu'à l'année courante + 5 ans
  const getAvailableYears = () => {
    const years = [];
    const startYear = 2024;
    const endYear = currentYear + 5;

    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    return years;
  };

  const availableYears = getAvailableYears();

  useEffect(() => {
    const fetchYearlySummary = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/sales/yearly-summary?year=${year}`);

        if (res.data) {
          setMonthlySummaries(res.data.monthlySummaries || []);
          setTotalSummary(res.data.totalSummary || {
            totalQuantity: 0,
            totalRevenue: 0,
            totalProfit: 0,
            totalCost: 0
          });
          setYearlySales(res.data.yearlySales || []);

          if (res.data.message) {
            setMessage(res.data.message);
          } else {
            setMessage("");
          }
        }
      } catch (err) {
        console.error(err);
        setMessage("Erreur lors du chargement du résumé annuel");
        setMonthlySummaries([]);
        setYearlySales([]);
        setTotalSummary({
          totalQuantity: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalCost: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchYearlySummary();
  }, [year]);

  const handleYearChange = (newYear) => {
    setYear(newYear);
    setExpandedMonth(null);
    setSelectedMonth(null);
  };

  const handlePreviousYear = () => {
    const currentIndex = availableYears.indexOf(year);
    if (currentIndex > 0) {
      setYear(availableYears[currentIndex - 1]);
      setExpandedMonth(null);
      setSelectedMonth(null);
    }
  };

  const handleNextYear = () => {
    const currentIndex = availableYears.indexOf(year);
    if (currentIndex < availableYears.length - 1) {
      setYear(availableYears[currentIndex + 1]);
      setExpandedMonth(null);
      setSelectedMonth(null);
    }
  };

  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('fr-FR') + ' FCFA';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMonthColor = (monthIndex) => {
    const colors = [
      "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
      "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16",
      "#F97316", "#6366F1", "#14B8A6", "#D946EF"
    ];
    return colors[monthIndex % colors.length];
  };

  const StatCard = ({ title, value, subtitle, icon, color = "#4f46e5" }) => (
    <div className="ys-stat-card" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="ys-stat-icon">{icon}</div>
      <div className="ys-stat-content">
        <div className="ys-stat-value">{value}</div>
        <div className="ys-stat-title">{title}</div>
        {subtitle && <div className="ys-stat-subtitle">{subtitle}</div>}
      </div>
    </div>
  );

  const getMonthName = (monthString) => {
    const months = {
      "janvier": "Janvier", "février": "Février", "mars": "Mars",
      "avril": "Avril", "mai": "Mai", "juin": "Juin",
      "juillet": "Juillet", "août": "Août", "septembre": "Septembre",
      "octobre": "Octobre", "novembre": "Novembre", "décembre": "Décembre"
    };
    return months[monthString?.toLowerCase()] || monthString;
  };

  const toggleMonthDetails = (monthIndex) => {
    if (expandedMonth === monthIndex) {
      setExpandedMonth(null);
    } else {
      setExpandedMonth(monthIndex);
    }
  };

  const getSalesForMonth = (monthName) => {
    return yearlySales.filter(sale => {
      const saleMonth = new Date(sale.date).toLocaleString("fr-FR", { month: "long" });
      return saleMonth.toLowerCase() === monthName.toLowerCase();
    });
  };

  if (loading) {
    return (
      <div className="ys-container">
        <div className="ys-loading">
          <div className="ys-spinner"></div>
          <p>Chargement du résumé annuel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ys-container">
      {/* Header avec sélecteur d'années */}
      <div className="ys-header">
        <div className="ys-header-content">
          <h2>Résumé Annuel des Ventes</h2>
          <p className="ys-subtitle">
            Aperçu complet des performances commerciales {year}
          </p>
        </div>

        <div className="ys-year-navigation">
          <button
            onClick={handlePreviousYear}
            className="ys-year-nav-btn"
            disabled={availableYears.indexOf(year) === 0}
            title="Année précédente"
          >
            ←
          </button>

          <div className="ys-year-selector">
            <select
              value={year}
              onChange={(e) => handleYearChange(parseInt(e.target.value))}
              className="ys-year-select"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleNextYear}
            className="ys-year-nav-btn"
            disabled={availableYears.indexOf(year) === availableYears.length - 1}
            title="Année suivante"
          >
            →
          </button>
        </div>
      </div>

      {/* Message d'information */}
      {message && (
        <div className="ys-message-container">
          <div className={`ys-message ${message.includes('Erreur') ? 'ys-error' : 'ys-info'}`}>
            <span className="ys-message-icon">{message.includes('Erreur') ? '⚠️' : 'ℹ️'}</span>
            {message}
          </div>
        </div>
      )}

      {/* Cartes de statistiques principales */}
      {yearlySales.length > 0 && (
        <div className="ys-stats-grid">
          <StatCard
            title="Total des Ventes"
            value={totalSummary.totalQuantity || 0}
            subtitle="unités vendues"
            icon="📦"
            color="#3B82F6"
          />
          <StatCard
            title="Chiffre d'Affaires"
            value={formatCurrency(totalSummary.totalRevenue)}
            subtitle="revenu annuel"
            icon="💰"
            color="#10B981"
          />
          <StatCard
            title="Profit Net"
            value={formatCurrency(totalSummary.totalProfit)}
            subtitle="bénéfice annuel"
            icon="📈"
            color="#059669"
          />
          <StatCard
            title="Coût Total"
            value={formatCurrency(totalSummary.totalCost)}
            subtitle="coût annuel"
            icon="💸"
            color="#EF4444"
          />
        </div>
      )}

      {/* Indicateurs de performance */}
      {totalSummary.totalRevenue > 0 && (
        <div className="ys-performance">
          <div className="ys-performance-item">
            <span className="ys-performance-label">Marge bénéficiaire :</span>
            <span className="ys-performance-value">
              {((totalSummary.totalProfit / totalSummary.totalRevenue) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="ys-performance-item">
            <span className="ys-performance-label">Vente moyenne :</span>
            <span className="ys-performance-value">
              {formatCurrency(totalSummary.totalRevenue / (totalSummary.totalQuantity || 1))}
            </span>
          </div>
          <div className="ys-performance-item">
            <span className="ys-performance-label">Mois actifs :</span>
            <span className="ys-performance-value">
              {monthlySummaries.filter(month => month.numberOfSales > 0).length}
            </span>
          </div>
          <div className="ys-performance-item">
            <span className="ys-performance-label">Nombre total de ventes :</span>
            <span className="ys-performance-value">
              {yearlySales.length}
            </span>
          </div>
        </div>
      )}

      {/* Tableau des mois avec détails expansibles */}
      <div className="ys-table-section">
        <div className="ys-table-header">
          <h3>Détail par Mois - {year}</h3>
          <div className="ys-months-count">
            <span className="ys-count-badge">{monthlySummaries.length}</span>
            mois analysés
          </div>
        </div>

        <div className="ys-table-container">
          <div className="ys-table-scroll">
            <table className="ys-summary-table">
              <thead>
                <tr>
                  <th>Mois</th>
                  <th>Ventes</th>
                  <th>Quantité</th>
                  <th>Chiffre d'Affaires</th>
                  <th>Profit</th>
                  <th>Coût</th>
                  <th>Performance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthlySummaries.map((month, index) => {
                  const monthColor = getMonthColor(index);
                  const profitMargin = month.summary?.totalRevenue > 0
                    ? (month.summary.totalProfit / month.summary.totalRevenue) * 100
                    : 0;
                  const monthSales = getSalesForMonth(month.month);

                  return (
                    <React.Fragment key={index}>
                      <tr
                        className={`${index % 2 === 0 ? "ys-even-row" : "ys-odd-row"} ${expandedMonth === index ? 'ys-expanded-row' : ''}`}
                      >
                        <td className="ys-month-cell">
                          <div
                            className="ys-month-indicator"
                            style={{ backgroundColor: monthColor }}
                          ></div>
                          <span className="ys-month-name">
                            {getMonthName(month.month)}
                          </span>
                        </td>
                        <td className="ys-sales-cell">
                          <span className="ys-sales-badge">{month.numberOfSales}</span>
                        </td>
                        <td className="ys-quantity-cell">
                          <span className="ys-quantity-value">
                            {month.summary?.totalQuantity || 0}
                          </span>
                        </td>
                        <td className="ys-revenue-cell">
                          {formatCurrency(month.summary?.totalRevenue)}
                        </td>
                        <td className="ys-profit-cell">
                          {formatCurrency(month.summary?.totalProfit)}
                        </td>
                        <td className="ys-cost-cell">
                          {formatCurrency(month.summary?.totalCost)}
                        </td>
                        <td className="ys-performance-cell">
                          <div className="ys-performance-bar">
                            <div
                              className="ys-performance-fill"
                              style={{
                                width: `${Math.min(profitMargin * 2, 100)}%`,
                                backgroundColor: profitMargin >= 20 ? '#10B981' :
                                  profitMargin >= 10 ? '#F59E0B' : '#EF4444'
                              }}
                            ></div>
                            <span className="ys-performance-text">
                              {profitMargin.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="ys-actions-cell">
                          <button
                            className="ys-expand-btn"
                            onClick={() => toggleMonthDetails(index)}
                            title={expandedMonth === index ? "Masquer les détails" : "Voir les détails"}
                          >
                            {expandedMonth === index ? '▼' : '▶'}
                          </button>
                        </td>
                      </tr>

                      {/* Ligne d'expansion avec les détails des ventes du mois */}

                      {expandedMonth === index && monthSales.length > 0 && (
                        <tr className="ys-details-row">
                          <td colSpan="8">
                            <div className="ys-month-details">
                              <h4>Détail des ventes - {getMonthName(month.month)} {year}</h4>
                              <div className="ys-details-table-container">
                                <table className="ys-details-table">
                                  <thead>
                                    <tr>
                                      <th>Date</th>
                                      <th>Produit</th>
                                      <th>Quantité</th>
                                      <th>Prix vente</th>
                                      <th>Réduction</th>
                                      <th>Prix final</th>
                                      <th>Profit</th>
                                      <th>Client</th>
                                      <th>Commentaire</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {monthSales.map((sale, idx) => (
                                      <tr key={idx}>
                                        <td>{formatDate(sale.date)}</td>
                                        <td>
                                          <div className="ys-product-info">
                                            {sale.productPhoto && (
                                              <img
                                                src={sale.productPhoto}
                                                alt={sale.productName}
                                                className="ys-product-thumb"
                                              />
                                            )}
                                            <span>{sale.productName}</span>
                                          </div>
                                        </td>
                                        <td>{sale.quantity}</td>
                                        <td>{formatCurrency(sale.sellingPrice)}</td>
                                        <td>{sale.discount}%</td>
                                        <td>{formatCurrency(sale.finalPrice)}</td>
                                        <td className={sale.profit >= 0 ? 'ys-profit-positive' : 'ys-profit-negative'}>
                                          {formatCurrency(sale.profit)}
                                        </td>
                                        <td>
                                          {sale.customerPhone ? (
                                            <a
                                              href={`https://wa.me//237${sale.customerPhone.replace(/[^0-9]/g, '')}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="ys-whatsapp-link"
                                              title={`Contacter ${sale.customerPhone} sur WhatsApp`}
                                            >
                                              <span className="ys-whatsapp-icon">📱</span>
                                              <span className="ys-phone-number">{sale.customerPhone}</span>
                                            </a>
                                          ) : (
                                            <span className="ys-no-phone">-</span>
                                          )}
                                        </td>
                                        <td className="ys-comment-cell">
                                          {sale.comment ? (
                                            <div className="ys-comment" title={sale.comment}>
                                              <span className="ys-comment-icon">💬</span>
                                              <span className="ys-comment-text">{sale.comment}</span>
                                            </div>
                                          ) : (
                                            <span className="ys-no-comment">-</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Résumé global */}
      {yearlySales.length > 0 && (
        <div className="ys-global-summary">
          <div className="ys-summary-header">
            <h3>Résumé Global {year}</h3>
            <div className="ys-summary-badge">
              {yearlySales.length} vente{yearlySales.length > 1 ? 's' : ''}
            </div>
          </div>

          <div className="ys-summary-grid">
            <div className="ys-summary-item">
              <div className="ys-summary-icon">📊</div>
              <div className="ys-summary-content">
                <div className="ys-summary-value">{totalSummary.totalQuantity || 0}</div>
                <div className="ys-summary-label">Quantité Totale</div>
              </div>
            </div>

            <div className="ys-summary-item">
              <div className="ys-summary-icon">💵</div>
              <div className="ys-summary-content">
                <div className="ys-summary-value">{formatCurrency(totalSummary.totalRevenue)}</div>
                <div className="ys-summary-label">Chiffre d'Affaires</div>
              </div>
            </div>

            <div className="ys-summary-item ys-highlight">
              <div className="ys-summary-icon">🎯</div>
              <div className="ys-summary-content">
                <div className="ys-summary-value">{formatCurrency(totalSummary.totalProfit)}</div>
                <div className="ys-summary-label">Profit Net</div>
              </div>
            </div>

            <div className="ys-summary-item">
              <div className="ys-summary-icon">⚡</div>
              <div className="ys-summary-content">
                <div className="ys-summary-value">
                  {monthlySummaries.filter(m => m.numberOfSales > 0).length}
                </div>
                <div className="ys-summary-label">Mois Actifs</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* État vide */}
      {yearlySales.length === 0 && !loading && (
        <div className="ys-empty-state">
          <div className="ys-empty-icon">📅</div>
          <h3>Aucune donnée pour {year}</h3>
          <p>{message || "Les données annuelles apparaîtront ici."}</p>
        </div>
      )}
    </div>
  );
};

export default YearlySummary;












// import React, { useEffect, useState } from "react";
// import { api } from "../../../api/api"; // ✅ garde le même chemin que WeeklySummary
// import "./YearlySummary.css";

// const YearlySummary = () => {
//   const [year, setYear] = useState(new Date().getFullYear());
//   const [monthlySummaries, setMonthlySummaries] = useState([]);
//   const [totalSummary, setTotalSummary] = useState({});
//   const [message, setMessage] = useState("");

//   useEffect(() => {
//     const fetchYearlySummary = async () => {
//       try {
//         const res = await api.get(`/api/sales/yearly-summary?year=${year}`);
//         setMonthlySummaries(res.data.monthlySummaries || []);
//         setTotalSummary(res.data.totalSummary || {});
//       } catch (err) {
//         console.error(err);
//         setMessage("Erreur lors du chargement du résumé annuel");
//       }
//     };
//     fetchYearlySummary();
//   }, [year]);

//   return (
//     <div className="yearly-summary-container">
//       <h2>Résumé des ventes de l'année {year}</h2>

//       <div className="year-selector">
//         <label>Choisir une année :</label>
//         <input
//           type="number"
//           value={year}
//           onChange={(e) => setYear(e.target.value)}
//           min="2000"
//           max={new Date().getFullYear()}
//         />
//       </div>

//       {message && <p className="error">{message}</p>}

//       <table className="yearly-summary-table">
//         <thead>
//           <tr>
//             <th>Mois</th>
//             <th>Nombre de ventes</th>
//             <th>Quantité totale</th>
//             <th>Chiffre d'affaires</th>
//             <th>Profit</th>
//             <th>Coût total</th>
//           </tr>
//         </thead>
//         <tbody>
//           {monthlySummaries.map((month, index) => (
//             <tr key={index}>
//               <td className="month-name">{month.month}</td>
//               <td>{month.numberOfSales}</td>
//               <td>{month.summary.totalQuantity || 0}</td>
//               <td>{(month.summary.totalRevenue || 0).toLocaleString()} FCFA</td>
//               <td>{(month.summary.totalProfit || 0).toLocaleString()} FCFA</td>
//               <td>{(month.summary.totalCost || 0).toLocaleString()} FCFA</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>

//       <div className="summary-totals">
//         <h3>Résumé global de l'année :</h3>
//         <ul>
//           <li>
//             <b>Quantité totale vendue :</b> {totalSummary.totalQuantity || 0}
//           </li>
//           <li>
//             <b>Chiffre d'affaires total :</b>{" "}
//             {totalSummary.totalRevenue?.toLocaleString() || 0} FCFA
//           </li>
//           <li>
//             <b>Profit total :</b>{" "}
//             {totalSummary.totalProfit?.toLocaleString() || 0} FCFA
//           </li>
//           <li>
//             <b>Coût total :</b>{" "}
//             {totalSummary.totalCost?.toLocaleString() || 0} FCFA
//           </li>
//         </ul>
//       </div>
//     </div>
//   );
// };

// export default YearlySummary;
