import { useLayoutEffect, useRef } from 'react';

/**
 * Ventana modal nativa (<dialog>) con el estilo del catálogo.
 * Se abre al montarse y se cierra al desmontarse; Escape llama a alCancelar
 * salvo mientras se está guardando.
 */
export default function Dialogo({ children, tituloId, descripcionId, guardando = false, alCancelar, ancho }) {
  const dialogo = useRef(null);

  useLayoutEffect(() => {
    const elemento = dialogo.current;
    elemento.showModal();
    return () => elemento.close();
  }, []);

  return (
    <dialog
      ref={dialogo}
      className="catalogo-dialogo"
      style={ancho ? { width: `min(${ancho}, calc(100% - 2rem))` } : undefined}
      aria-labelledby={tituloId}
      aria-describedby={descripcionId}
      onCancel={(evento) => {
        evento.preventDefault();
        if (!guardando) alCancelar();
      }}
    >
      {children}
    </dialog>
  );
}
