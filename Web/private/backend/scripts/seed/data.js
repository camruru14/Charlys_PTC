/*
  Datos base para inventar personas, negocios y direcciones salvadoreñas. Todo es ficticio.
*/

export const FIRST_NAMES_F = [
  "María", "Ana", "Karla", "Sofía", "Gabriela", "Daniela", "Andrea", "Carolina", "Verónica", "Lucía",
  "Patricia", "Claudia", "Rosa", "Marta", "Elena", "Beatriz", "Yesenia", "Mirna", "Julia", "Sandra",
  "Alejandra", "Fátima", "Rocío", "Xiomara", "Wendy", "Jessica", "Lorena", "Silvia", "Nora", "Cecilia",
];
export const FIRST_NAMES_M = [
  "José", "Carlos", "Luis", "Miguel", "Juan", "Roberto", "Ricardo", "Fernando", "Óscar", "Jorge",
  "Mario", "Manuel", "Rafael", "Héctor", "Víctor", "Pedro", "Walter", "Marvin", "Ernesto", "Julio",
  "Douglas", "Edgardo", "Nelson", "Alexis", "Santos", "Wilfredo", "Giovanni", "Mauricio", "Rodrigo", "Salvador",
];
export const LAST_NAMES = [
  "Hernández", "Martínez", "López", "García", "Rodríguez", "Pérez", "Gómez", "Flores", "Ramírez", "Cruz",
  "Mejía", "Rivera", "Alvarado", "Portillo", "Menjívar", "Guardado", "Orellana", "Cañas", "Aguilar", "Castillo",
  "Rivas", "Alfaro", "Chávez", "Argueta", "Benítez", "Campos", "Cortez", "Deras", "Escobar", "Fuentes",
  "Guzmán", "Henríquez", "Lara", "Molina", "Nolasco", "Ortiz", "Peña", "Quintanilla", "Ramos", "Sandoval",
  "Torres", "Umaña", "Valle", "Villalta", "Zelaya", "Amaya", "Bonilla", "Calderón", "Díaz", "Erazo",
];

// Municipios (y departamento) agrupados por zona de reparto.
export const ZONES = {
  "Zona Metropolitana": {
    weight: 55,
    towns: [
      ["San Salvador", "San Salvador"], ["Soyapango", "San Salvador"], ["Mejicanos", "San Salvador"],
      ["Ciudad Delgado", "San Salvador"], ["Ilopango", "San Salvador"], ["San Marcos", "San Salvador"],
      ["Cuscatancingo", "San Salvador"], ["Ayutuxtepeque", "San Salvador"],
    ],
  },
  "Zona Norte": {
    weight: 10,
    towns: [["Apopa", "San Salvador"], ["Nejapa", "San Salvador"], ["Quezaltepeque", "La Libertad"], ["Aguilares", "San Salvador"], ["Tonacatepeque", "San Salvador"]],
  },
  "Zona Occidente": {
    weight: 18,
    towns: [
      ["Santa Tecla", "La Libertad"], ["Antiguo Cuscatlán", "La Libertad"], ["Zaragoza", "La Libertad"],
      ["Santa Ana", "Santa Ana"], ["Sonsonate", "Sonsonate"], ["Ahuachapán", "Ahuachapán"], ["Armenia", "Sonsonate"],
    ],
  },
  "Zona Paracentral": {
    weight: 7,
    towns: [["San Vicente", "San Vicente"], ["Cojutepeque", "Cuscatlán"], ["Zacatecoluca", "La Paz"], ["Olocuilta", "La Paz"], ["San Pedro Masahuat", "La Paz"]],
  },
  "Zona Oriente": {
    weight: 10,
    towns: [["San Miguel", "San Miguel"], ["Usulután", "Usulután"], ["La Unión", "La Unión"], ["San Francisco Gotera", "Morazán"], ["Santa Rosa de Lima", "La Unión"]],
  },
};

// Días de la semana (0 = domingo) en que sale ruta a cada zona. La metropolitana, todos los días.
export const ZONE_ROUTE_DAYS = {
  "Zona Metropolitana": [1, 2, 3, 4, 5, 6],
  "Zona Norte": [2, 5],
  "Zona Occidente": [1, 3, 5],
  "Zona Paracentral": [3],
  "Zona Oriente": [2, 4],
};

export const STREETS = [
  "Calle Los Andes", "Avenida Roosevelt", "Boulevard Constitución", "Calle Principal", "Avenida Independencia",
  "Calle Circunvalación", "Boulevard del Ejército", "Avenida Bernal", "Calle Real", "Avenida Las Palmeras",
  "Calle Los Almendros", "Boulevard Venezuela", "Avenida Los Próceres", "Calle El Progreso", "Pasaje Las Flores",
];
export const NEIGHBORHOODS = [
  "Col. Escalón", "Col. Miramonte", "Res. Altavista", "Col. San Benito", "Barrio San Jacinto", "Col. Layco",
  "Urb. Santa Eduviges", "Col. Médica", "Barrio El Calvario", "Col. Zacamil", "Urb. Jardines de la Sabana", "Centro",
  "Col. Flor Blanca", "Res. Los Héroes", "Barrio Concepción", "Col. La Sultana", "Barrio El Centro",
];

// Tipos de negocio: cuánto compran de cada categoría (share de pelotas) y su escala.
export const BUSINESS_KINDS = [
  { kind: "Restaurante", pelotas: 0.02, scales: ["small", "medium"], weight: 14 },
  { kind: "Pupusería", pelotas: 0, scales: ["small", "medium"], weight: 12 },
  { kind: "Cafetería", pelotas: 0, scales: ["small", "medium"], weight: 12 },
  { kind: "Heladería", pelotas: 0.05, scales: ["small", "medium"], weight: 7 },
  { kind: "Comedor", pelotas: 0, scales: ["small"], weight: 8 },
  { kind: "Panadería", pelotas: 0, scales: ["small", "medium"], weight: 5 },
  { kind: "Licuados y Frutas", pelotas: 0, scales: ["small", "medium"], weight: 5 },
  { kind: "Hotel", pelotas: 0.12, scales: ["medium", "large"], weight: 5 },
  { kind: "Minisúper", pelotas: 0.1, scales: ["small", "medium"], weight: 6 },
  { kind: "Distribuidora", pelotas: 0.35, scales: ["large", "medium"], weight: 8 },
  { kind: "Juguetería", pelotas: 0.9, scales: ["medium", "small"], weight: 5 },
  { kind: "Parque Acuático", pelotas: 0.85, scales: ["large", "medium"], weight: 3 },
  { kind: "Guardería", pelotas: 0.6, scales: ["small"], weight: 3 },
];
export const BUSINESS_TAGS = [
  "Doña Chepa", "El Buen Sabor", "La Esquina", "Los Cebollines", "Las Delicias", "El Rincón Cuscatleco", "Santa Lucía",
  "Don Pepe", "La Tradición", "El Mirador", "Los Pinos", "San Antonio", "La Casona", "Mi Pueblito", "El Cafetal",
  "Los Naranjos", "Tierra Linda", "El Volcán", "La Palma", "Doña Tey", "Casa Blanca", "El Encanto", "La Ceiba",
  "Los Tres Hermanos", "Costa del Sol", "Monte Verde", "El Trébol", "La Fuente", "San Rafael", "Villa Real",
  "El Jocote", "Los Amates", "Sabor Salvadoreño", "El Pacífico", "Rincón Típico", "La Flor", "Mundo Feliz", "Alegría",
];

export const ORDER_NOTES = [
  "Entregar por la mañana, por favor.",
  "Preguntar por el encargado de compras.",
  "Llamar antes de llegar.",
  "Recibe el portero del edificio.",
  "Favor entregar antes de las 3:00 p.m.",
  "Es para un evento del fin de semana.",
  "Dejar con la cajera.",
];

export const STOP_REASONS = [
  "Falla en la extrusora",
  "Cambio de molde",
  "Falta de materia prima",
  "Corte de energía eléctrica",
  "Ajuste de temperatura de la máquina",
];

export const RAW_MATERIALS = [
  { name: "Resina de polipropileno (PP)", type: "Resina", materialType: "Polimero", unit: "kg", stock: 4200, minStock: 1500, unitCost: 1.35 },
  { name: "Resina de polietileno de baja densidad (LDPE)", type: "Resina", materialType: "Polimero", unit: "kg", stock: 2600, minStock: 1200, unitCost: 1.42 },
  { name: "Resina de poliestireno (PS)", type: "Resina", materialType: "Polimero", unit: "kg", stock: 900, minStock: 1000, unitCost: 1.58 },
  { name: "Masterbatch rojo", type: "Colorante", materialType: "Aditivo", color: "Rojo", unit: "kg", stock: 120, minStock: 60, unitCost: 6.4 },
  { name: "Masterbatch azul", type: "Colorante", materialType: "Aditivo", color: "Azul", unit: "kg", stock: 95, minStock: 60, unitCost: 6.4 },
  { name: "Masterbatch amarillo", type: "Colorante", materialType: "Aditivo", color: "Amarillo", unit: "kg", stock: 70, minStock: 60, unitCost: 6.6 },
  { name: "Masterbatch verde", type: "Colorante", materialType: "Aditivo", color: "Verde", unit: "kg", stock: 40, minStock: 50, unitCost: 6.5 },
  { name: "Masterbatch blanco", type: "Colorante", materialType: "Aditivo", color: "Blanco", unit: "kg", stock: 150, minStock: 80, unitCost: 5.2 },
  { name: "Masterbatch negro", type: "Colorante", materialType: "Aditivo", color: "Negro", unit: "kg", stock: 110, minStock: 60, unitCost: 4.9 },
  { name: "Tinta para marcado de bolsas", type: "Tinta", materialType: "Tinta", unit: "litro", stock: 18, minStock: 10, unitCost: 14.5 },
  { name: "Bolsas plásticas de empaque", type: "Empaque", materialType: "Insumo", unit: "caja", stock: 85, minStock: 40, unitCost: 22 },
  { name: "Cajas de cartón corrugado", type: "Empaque", materialType: "Insumo", unit: "unidad", stock: 640, minStock: 300, unitCost: 0.85 },
  { name: "Cinta adhesiva de empaque", type: "Empaque", materialType: "Insumo", unit: "caja", stock: 14, minStock: 10, unitCost: 31 },
  { name: "Aceite lubricante para maquinaria", type: "Lubricante", materialType: "Insumo", unit: "litro", stock: 0, minStock: 20, unitCost: 5.8 },
];
