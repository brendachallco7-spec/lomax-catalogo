import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API = "/api";

export default function Catalogo() {
  const [productos, setProductos] = useState([]);
  const [error, setError] = useState("");

  async function cargar() {
    try {
      const response = await fetch(`${API}/productos`);

      if (!response.ok) {
        throw new Error("No se pudieron cargar los productos");
      }

      setProductos(await response.json());
    } catch (error) {
      setError(error.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <section className="catalogo">
      <div className="titulo-seccion">
        <div>
          <p className="empresa">LOMAX SA</p>
          <h2>Catálogo de productos</h2>
        </div>

        <Link className="btn-principal" to="/registrar">
          + Registrar producto
        </Link>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="productos">
        {productos.map((producto) => (
          <article className="card" key={producto.producto_id}>
            <div className="imagen">
              <img
                src={`${API}/productos/${producto.producto_id}/imagen`}
                alt={producto.nombre}
              />
            </div>

            <div className="contenido">
              <span className="categoria">
                {producto.categoria}
              </span>

              <h3>{producto.nombre}</h3>

              <p className="codigo">
                Código: {producto.codigo}
              </p>

              <p className="descripcion">
                {producto.descripcion}
              </p>

              <div className="pie-card">
                <strong>
                  Bs. {Number(producto.precio).toFixed(2)}
                </strong>

                <Link
                  className="btn-detalle"
                  to={`/producto/${producto.producto_id}`}
                >
                  Ver detalle
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
