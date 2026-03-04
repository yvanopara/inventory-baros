import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";

import { AuthProvider } from "./AuthContext";

import Login from "./pages/login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import AddSale from "./pages/AddSale/AddSale";

import DailySummary from "./pages/saleHistory/DailySummary/DailySummary";
import WeeklySummary from "./pages/saleHistory/WeeklySummary/WeeklySummary";
import MonthlySummary from "./pages/saleHistory/MonthlySummary/MonthlySummary";

import ReserveSales from "./pages/ReserveSale/ReserveSale";


import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import SidebarMenu from "./components/sideBarMenu/sideBarMenu";
import About from "./pages/about/ABout";

// BACKEND URL
// export const backendUrl = "http://localhost:5000";
 //export const backendUrl = "https://inventory2-uexd.onrender.com";
export const backendUrl = "https://backend-k1u6.onrender.com";

// export const backendUrl = "https://inventory-vrlw.onrender.com";


// =====================
//    AppContent
// =====================
function AppContent() {
  const location = useLocation();

  return (
    <>
      {/* Sidebar affiché sauf sur /login */}
      {location.pathname !== "/" && <SidebarMenu />}

      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/add-sale" element={<AddSale />} />

        <Route path="/daily-summary" element={<DailySummary />} />
        <Route path="/weekly-summary" element={<WeeklySummary />} />
        <Route path="/monthly-summary" element={<MonthlySummary />} />

        <Route path="/reservation" element={<ReserveSales />} />
         <Route path="/about" element={<About />} />
      </Routes>
    </>
  );
}


// =====================
//       APP
// =====================
function App() {
  return (
    <AuthProvider>
      <ToastContainer position="top-center" />
    
        <AppContent />
      
    </AuthProvider>
  );
}

export default App;
