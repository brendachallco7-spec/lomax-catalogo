import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Catalogo from "./pages/Catalogo";
import RegistrarProducto from "./pages/RegistrarProducto";
import DetalleProducto from "./pages/DetalleProducto";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="header">
          <Link to="/" className="logo">
            LOMAX <span>SA</span>
          </Link>

          <nav>
            <Link to="/">Catálogo</Link>
            <Link to="/registrar">Registrar producto</Link>
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Catalogo />} />
            <Route path="/registrar" element={<RegistrarProducto />} />
            <Route path="/producto/:id" element={<DetalleProducto />} />
          </Routes>
        </main>

        <footer>
          <p>© 2026 Lomax SA - Catálogo de productos tecnológicos</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;