// En escritorio muestra la app dentro de un teléfono (ideal para presentar); en celular, pantalla completa.
export default function PhoneFrame({ children, side }) {
  return (
    <div className="phone-stage">
      <div className="phone">{children}</div>
      {side && <div className="phone-side">{side}</div>}
    </div>
  );
}
