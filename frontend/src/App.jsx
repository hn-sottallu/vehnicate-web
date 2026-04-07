import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Home from "./pages/Home";
import WaitlistPage from "./pages/WaitlistPage";
import MapPage from "./pages/MapPage";
import hnOpsinGuide from "./pages/hnOpsinGuide";
import "./styles/globals.css";

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageWrapper>
              <Home />
            </PageWrapper>
          }
        />
        <Route
          path="/waitlist"
          element={
            <PageWrapper>
              <WaitlistPage />
            </PageWrapper>
          }
        />
        <Route
          path="/map"
          element={
            <PageWrapper>
              <MapPage />
            </PageWrapper>
          }
        />
        <Route path="/guide" element={<hnOpsinGuide />} />
      </Routes>
    </AnimatePresence>
  );
}

function PageWrapper({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="min-h-screen"
    >
      {children}
    </motion.div>
  );
}

function App() {
  return (
    <div className="App">
      <AnimatedRoutes />
    </div>
  );
}

export default App;