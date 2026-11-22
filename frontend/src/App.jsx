
import { useEffect, useState } from 'react';

function App() {
  const [mensaje, setMensaje] = useState('Conectando...');

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/estado')
      .then((respuesta) => {
        if (!respuesta.ok) {
          throw new Error('Error al consultar la API');
        }

        return respuesta.json();
      })
      .then((datos) => {
        setMensaje(datos.mensaje);
      })
      .catch(() => {
        setMensaje('No se pudo conectar con Laravel');
      });
  }, []);

  return (
    <main style={{ padding: '40px', fontFamily: 'Arial' }}>
      <h1>Librería Independencia</h1>
      <h2>Sistema de Gestión de Inventario</h2>
      <p>Estado del servidor: {mensaje}</p>
    </main>
  );
}

export default App;
