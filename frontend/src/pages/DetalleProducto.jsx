import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const API = "/api";

export default function DetalleProducto() {
  const { id } = useParams();

  const [producto, setProducto] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/productos/${id}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Producto no encontrado");
        }

        return response.json();
      })
      .then(setProducto)
      .catch((error) => setError(error.message));
  }, [id]);

  if (error) {
    return (
      <section className="detalle">
        <div className="error">{error}</div>
        <Link to="/" className="btn-principal">
          Volver al catálogo
        </Link>
      </section>
    );
  }

  if (!producto) {
    return <p className="mensaje">Cargando producto...</p>;
  }

  return (
    <section className="detalle">
      <Link to="/" className="volver">
        ← Volver al catálogo
      </Link>

      <div className="detalle-contenedor">
        <div className="detalle-imagen">
          <img
            src={`${API}/productos/${producto.producto_id}/imagen`}
            alt={producto.nombre}
          />
        </div>

        <div className="detalle-info">
          <span className="categoria">
            {producto.categoria}
          </span>

          <h1>{producto.nombre}</h1>

          <p className="codigo">
            Código: {producto.codigo}
          </p>

          <div className="precio">
            Bs. {Number(producto.precio).toFixed(2)}
          </div>

          <p className="detalle-descripcion">
            {producto.descripcion}
          </p>

          <h3>Características</h3>

          <div className="atributos">
            {producto.atributos &&
              Object.entries(producto.atributos).map(
                ([nombre, valor]) => (
                  <span key={nombre}>
                    <strong>{nombre}:</strong> {valor}
                  </span>
                )
              )}
          </div>

          <div className="estado-detalle">
            Estado: {producto.estado}
          </div>
        </div>
      </div>
    </section>
  );
}
