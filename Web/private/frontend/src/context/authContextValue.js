import { createContext } from "react";

// Contexto global de autenticación del panel administrativo. Vive aparte de
// AuthContext.jsx (que solo exporta el Provider) para que Fast Refresh funcione.
export const AuthContext = createContext(null);

export default AuthContext;
