import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API = "/api";

export default function RegistrarProducto() {
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    precio: "",
    categoria_id: "",
    atributos: "",
  });

  const [imagen, setImagen] = useState(null);
  const [productoId, setProductoId] = useState(null);
  const [estado, setEstado] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function cambiarCampo(e) {
    setFormulario({
      ...formulario,
      [e.target.name]: e.target.value,
    });
  }

  function convertirAtributos(texto) {
    const atributos = {};

    texto.split(",").forEach((elemento) => {
      const partes = elemento.split(":");

      if (partes.length >= 2) {
        const clave = partes[0].trim();
        const valor = partes.slice(1).join(":").trim();

        if (clave && valor) {
          atributos[clave] = valor;
        }
      }
    });

    return atributos;
  }

  async function registrarProducto(e) {
    e.preventDefault();

    setError("");
    setMensaje("");
    setCargando(true);

    try {
      if (!formulario.codigo.trim()) {
        throw new Error("Debes ingresar el código del producto.");
      }

      if (!formulario.nombre.trim()) {
        throw new Error("Debes ingresar el nombre del producto.");
      }

      if (!formulario.precio) {
        throw new Error("Debes ingresar el precio.");
      }

      if (!formulario.categoria_id) {
        throw new Error("Debes seleccionar una categoría.");
      }

      if (!formulario.atributos.trim()) {
        throw new Error("Debes ingresar al menos un atributo.");
      }

      if (!imagen) {
        throw new Error("Debes seleccionar una fotografía.");
      }

      // Crear producto en RDS
      const productoResponse = await fetch(`${API}/productos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          codigo: formulario.codigo.trim(),
          nombre: formulario.nombre.trim(),
          descripcion: formulario.descripcion.trim(),
          precio: Number(formulario.precio),
          categoria_id: Number(formulario.categoria_id),

          // IMPORTANTE:
          // El backend espera "attributes"
          attributes: convertirAtributos(formulario.atributos),
        }),
      });

      const productoData = await productoResponse.json();

      if (!productoResponse.ok) {
        throw new Error(
          productoData.error || "No se pudo registrar el producto."
        );
      }

      const id = productoData.producto_id;

      setProductoId(id);
      setEstado("PENDIENTE");

      setMensaje(
        `Producto #${id} creado correctamente. Procesando fotografía...`
      );

      // Subir fotografía
      const datosImagen = new FormData();
      datosImagen.append("imagen", imagen);

      const imagenResponse = await fetch(
        `${API}/productos/${id}/imagen`,
        {
          method: "POST",
          body: datosImagen,
        }
      );

      const imagenData = await imagenResponse.json();

      if (!imagenResponse.ok) {
        throw new Error(
          imagenData.error || "No se pudo procesar la fotografía."
        );
      }

      setEstado("PUBLICADO");

      setMensaje(
        `Producto #${id} publicado correctamente. La miniatura fue generada.`
      );

      // Ir al detalle después de 1.2 segundos
      setTimeout(() => {
        navigate(`/producto/${id}`);
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function reprocesar() {
    if (!productoId) return;

    setError("");
    setMensaje("Reprocesando fotografía...");
    setCargando(true);

    try {
      const response = await fetch(
        `${API}/productos/${productoId}/reprocesar`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "No se pudo reprocesar el producto."
        );
      }

      setEstado("PUBLICADO");

      setMensaje(
        `Producto #${productoId} publicado correctamente después del reprocesamiento.`
      );

      setTimeout(() => {
        navigate(`/producto/${productoId}`);
      }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="registrar">
      <Link to="/" className="volver">
        ← Volver al catálogo
      </Link>

      <div className="formulario">
        <div className="form-header">
          <p className="empresa">LOMAX SA</p>

          <h1>Registrar producto</h1>

          <p>
            Registra la información del producto, sus atributos y fotografía.
          </p>
        </div>

        {mensaje && (
          <div className="success">
            {mensaje}
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {productoId && (
          <div className="success">
            <strong>Producto ID:</strong> {productoId}
            <br />
            <strong>Estado:</strong> {estado}
          </div>
        )}

        <form onSubmit={registrarProducto}>
          <div className="form-grid">
            <div className="campo">
              <label>Código *</label>

              <input
                type="text"
                name="codigo"
                value={formulario.codigo}
                onChange={cambiarCampo}
                placeholder="Ej. LOM-003"
                required
              />
            </div>

            <div className="campo">
              <label>Nombre *</label>

              <input
                type="text"
                name="nombre"
                value={formulario.nombre}
                onChange={cambiarCampo}
                placeholder="Ej. Laptop Lenovo"
                required
              />
            </div>
          </div>

          <div className="campo">
            <label>Descripción</label>

            <textarea
              name="descripcion"
              value={formulario.descripcion}
              onChange={cambiarCampo}
              placeholder="Descripción del producto"
            />
          </div>

          <div className="form-grid">
            <div className="campo">
              <label>Precio *</label>

              <input
                type="number"
                name="precio"
                value={formulario.precio}
                onChange={cambiarCampo}
                min="0"
                step="0.01"
                placeholder="4500.00"
                required
              />
            </div>

            <div className="campo">
              <label>Categoría *</label>

              <select
                name="categoria_id"
                value={formulario.categoria_id}
                onChange={cambiarCampo}
                required
              >
                <option value="">
                  Seleccionar categoría
                </option>

                <option value="1">
                  Laptops
                </option>

                <option value="2">
                  Monitores
                </option>

                <option value="3">
                  Periféricos
                </option>

                <option value="4">
                  Celulares
                </option>

                <option value="5">
                  Componentes
                </option>
              </select>
            </div>
          </div>

          <div className="campo">
            <label>Atributos variables *</label>

            <input
              type="text"
              name="atributos"
              value={formulario.atributos}
              onChange={cambiarCampo}
              placeholder="RAM: 16GB, almacenamiento: 512GB SSD, conexion: USB-C"
              required
            />

            <small>
              Ejemplo: RAM: 16GB, almacenamiento: 512GB SSD
            </small>
          </div>

          <div className="campo">
            <label>Fotografía *</label>

            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => setImagen(e.target.files[0])}
              required
            />

            <small>
              Formatos permitidos: JPEG o PNG. Tamaño máximo: 5 MB.
            </small>
          </div>

          <button
            type="submit"
            className="btn-enviar"
            disabled={cargando}
          >
            {cargando
              ? "Procesando..."
              : "Registrar y publicar producto"}
          </button>
        </form>

        {error && productoId && (
          <button
            type="button"
            className="btn-enviar"
            onClick={reprocesar}
            disabled={cargando}
            style={{ marginTop: "15px" }}
          >
            Reintentar procesamiento
          </button>
        )}
      </div>
    </section>
  );
}
