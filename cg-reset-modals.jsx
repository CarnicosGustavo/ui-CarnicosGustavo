/* ============================================================
   RESET DE DATOS (Clientes, Pedidos, Cobranza)
   ============================================================ */

const { useState } = React;

function ResetClientesModal({ open, onClose, onConfirm }) {
  const [pwd, setPwd] = useState("");
  const [reset, setReset] = useState("");
  const [loading, setLoading] = useState(false);
  
  const canSubmit = pwd.length > 3 && reset === "RESET";
  const handleConfirm = () => {
    setLoading(true);
    setTimeout(() => {
      onConfirm?.("clientes");
      setPwd(""); setReset("");
      setLoading(false);
      onClose();
    }, 800);
  };

  return (
    <Modal open={open} onClose={onClose} icon="users-x" title="Reset de Clientes" width={580}
      footer={
        <>
          <Btn kind="outline" onClick={onClose}>Cancelar</Btn>
          <Btn kind="danger" onClick={handleConfirm} disabled={!canSubmit || loading}>
            {loading ? "Procesando..." : "🗑️ Borrar clientes"}
          </Btn>
        </>
      }>
      <div style={{ padding:"16px", background:"#3a3a2e", borderRadius:10, marginBottom:20, borderLeft:"3px solid #c41e3a" }}>
        <p style={{ margin:0, font:"500 13px/1.5 Archivo", color:"#f5f5f5" }}>
          Borra todos los clientes, pedidos abiertos, saldos y precios especiales. 
          <strong> Se genera respaldo automático antes de borrar.</strong> Puedes recuperar datos hasta 30 días atrás.
        </p>
      </div>

      <FormField label="Contraseña de administrador">
        <TextInput type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="••••••••" />
      </FormField>

      <FormField label='Escribe "RESET" para confirmar'>
        <TextInput value={reset} onChange={e=>setReset(e.target.value.toUpperCase())} placeholder='Escribe "RESET"' />
      </FormField>

      <div style={{ padding:12, background:"#f5f5f5", borderRadius:8, font:"500 12px/1.4 Archivo", color:"#777" }}>
        <strong>⚠️ Esta acción es irreversible.</strong> Los datos de clientes y pedidos se borrarán. Podrás restaurar desde 
        la copia de seguridad en <code style={{ font:"600 11px Courier New", color:"#333" }}>Settings → Backup</code>.
      </div>
    </Modal>
  );
}

function ResetPedidosModal({ open, onClose, onConfirm }) {
  const [pwd, setPwd] = useState("");
  const [reset, setReset] = useState("");
  const [loading, setLoading] = useState(false);
  
  const canSubmit = pwd.length > 3 && reset === "RESET";
  const handleConfirm = () => {
    setLoading(true);
    setTimeout(() => {
      onConfirm?.("pedidos");
      setPwd(""); setReset("");
      setLoading(false);
      onClose();
    }, 800);
  };

  return (
    <Modal open={open} onClose={onClose} icon="trash2" title="Reset de Pedidos" width={580}
      footer={
        <>
          <Btn kind="outline" onClick={onClose}>Cancelar</Btn>
          <Btn kind="danger" onClick={handleConfirm} disabled={!canSubmit || loading}>
            {loading ? "Procesando..." : "🗑️ Borrar pedidos"}
          </Btn>
        </>
      }>
      <div style={{ padding:"16px", background:"#3a3a2e", borderRadius:10, marginBottom:20, borderLeft:"3px solid #c41e3a" }}>
        <p style={{ margin:0, font:"500 13px/1.5 Archivo", color:"#f5f5f5" }}>
          Borra todos los pedidos abiertos, pesaje y cobranza asociada. 
          <strong> Se genera respaldo automático antes de borrar.</strong> Puedes recuperar datos hasta 30 días atrás.
        </p>
      </div>

      <FormField label="Contraseña de administrador">
        <TextInput type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="••••••••" />
      </FormField>

      <FormField label='Escribe "RESET" para confirmar'>
        <TextInput value={reset} onChange={e=>setReset(e.target.value.toUpperCase())} placeholder='Escribe "RESET"' />
      </FormField>

      <div style={{ padding:12, background:"#f5f5f5", borderRadius:8, font:"500 12px/1.4 Archivo", color:"#777" }}>
        <strong>⚠️ Esta acción es irreversible.</strong> Los pedidos se borrarán. Podrás restaurar desde 
        la copia de seguridad en <code style={{ font:"600 11px Courier New", color:"#333" }}>Settings → Backup</code>.
      </div>
    </Modal>
  );
}

window.ResetClientesModal = ResetClientesModal;
window.ResetPedidosModal = ResetPedidosModal;
