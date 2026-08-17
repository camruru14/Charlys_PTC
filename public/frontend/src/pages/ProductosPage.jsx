import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import useFetch from "../hooks/useFetch";

const CATEGORIES = ["Todos", "Pelotas", "Pajillas"];

export default function ProductosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "Todos";
  const [search, setSearch] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (category !== "Todos") params.set("category", category);
    if (search) params.set("search", search);
    const qs = params.toString();
    return `/products${qs ? `?${qs}` : ""}`;
  }, [category, search]);

  const { data: products, loading } = useFetch(query, [query]);

  const setCategory = (value) => {
    const params = new URLSearchParams(searchParams);
    if (value === "Todos") params.delete("category");
    else params.set("category", value);
    setSearchParams(params);
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-16 md:py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Catálogo</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
          Todos nuestros productos.
        </h1>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                category === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-secondary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar productos…"
          className="w-full max-w-xs rounded-xl border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary"
        />
      </div>

      {loading && <p className="mt-16 text-muted-foreground">Cargando productos…</p>}

      {!loading && products?.length === 0 && (
        <p className="mt-16 text-muted-foreground">
          No encontramos productos con esos filtros.
        </p>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products?.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </section>
  );
}
