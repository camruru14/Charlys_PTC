import { createContext } from "react";

// Contexto de las burbujas de novedades. Vive aparte de ActivityContext.jsx
// (que solo exporta el Provider) para que Fast Refresh funcione.
export const ActivityContext = createContext(null);

export default ActivityContext;
