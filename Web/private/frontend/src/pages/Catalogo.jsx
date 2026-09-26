import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useFetch } from "../hooks/useFetch";
import { useConfirm } from "../hooks/useConfirm";
import { useUrlState } from "../hooks/useUrlState";
import publicApi from "../lib/publicApi";
import ConfirmModal from "../components/ui/ConfirmModal";
import ProductFormModal from "../components/catalog/ProductFormModal";
import ProductCatalogCard from "../components/catalog/ProductCatalogCard";
import { AsyncState } from "../components/ui/SectionCard";
import KpiInline from "../components/ui/KpiInline";
import Tabs from "../components/ui/Tabs";
import Button from "../components/ui/Button";
import { IconLink, IconPlus } from "../lib/icons";
import { buttonClass } from "../lib/buttonStyles";
import { fmtNumber } from "../lib/format";
import PageHeader from "../components/ui/PageHeader";
import { getPageMeta } from "../lib/nav";

// URL de la tienda pública; sin ella no se muestra «Ver tienda pública».
const PUBLIC_STORE_URL = import.meta.env.VITE_PUBLIC_STORE_URL || "";
const ALL = "todas";

const emptyForm = {
  name: "",
  category: "Pelotas",
  description: "",
  price: "",
  compareAtPrice: "",
  colors: [],
  minOrderQuantity: 1,
  stock: 0,
  featured: false,
  active: true,
  images: [],
};

/*
  Administración del catálogo de la tienda pública (public/backend). Vive en
  el panel privado porque usa la misma sesión de empleado para autenticarse
  contra public/backend (ver src/lib/publicApi.js) — no hay login aparte.
  Muestra los productos como cards (no tabla): imagen, nombre, categoría,
  precio y colores, que es lo que un catálogo de e-commerce necesita ver de
  un vistazo, a diferencia de las tablas del resto del panel.
*/
function Catalogo() {
  const { confirm, confirmProps } = useConfirm();
  const { data, loading, error, refetch } = useFetch("/products/admin/all", { client: publicApi });
  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // Pestañas: «Todas» y cada categoría que existe, con su conteo (?categoria=).
  const categories = useMemo(() => [...new Set(list.map((p) => p.category).filter(Boolean))].sort(), [list]);
  const [categoryParam, setCategoryParam] = useUrlState("categoria", ALL);
  const category = categories.find((c) => c.toLowerCase() === categoryParam) || ALL;
  const tabs = [
    { key: ALL, label: `Todas · ${fmtNumber(list.length)}` },
    ...categories.map((c) => ({ key: c.toLowerCase(), label: `${c} · ${fmtNumber(list.filter((p) => p.category === c).length)}` })),
  ];
  const filtered = category === ALL ? list : list.filter((p) => p.category === category);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [removingImage, setRemovingImage] = useState(null);

  const kpis = useMemo(
    () => ({
      total: list.length,
      active: list.filter((p) => p.active !== false).length,
      featured: list.filter((p) => p.featured).length,
    }),
    [list],
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(product) {
    setEditingId(product._id);
    setForm({
      name: product.name || "",
      category: product.category,
      description: product.description || "",
      price: product.price ?? "",
      compareAtPrice: product.compareAtPrice ?? "",
      colors: product.colors || [],
      minOrderQuantity: product.minOrderQuantity ?? 1,
      stock: product.stock ?? 0,
      featured: !!product.featured,
      active: product.active !== false,
      images: product.images || [],
    });
    setModalOpen(true);
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  function toggleColor(color) {
    setForm((f) => ({
      ...f,
      colors: f.colors.includes(color) ? f.colors.filter((c) => c !== color) : [...f.colors, color],
    }));
  }

  async function uploadImages(productId, files) {
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    await publicApi.post(`/products/${productId}/images`, formData, { isForm: true });
  }

  async function handleSubmit(pendingFiles) {
    setSaving(true);
    const { images, ...rest } = form;
    const payload = {
      ...rest,
      price: Number(form.price) || 0,
      compareAtPrice: form.compareAtPrice === "" ? undefined : Number(form.compareAtPrice) || 0,
      minOrderQuantity: Number(form.minOrderQuantity) || 1,
      stock: Number(form.stock) || 0,
    };

    try {
      let productId = editingId;
      if (editingId) {
        await publicApi.put(`/products/${editingId}`, payload);
        toast.success("Producto actualizado");
      } else {
        const created = await publicApi.post("/products", payload);
        productId = created._id;
        toast.success("Producto creado");
      }

      if (pendingFiles.length) {
        await uploadImages(productId, pendingFiles);
      }

      setModalOpen(false);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product) {
    if (!(await confirm(`¿Eliminar "${product.name}"? También se borran sus imágenes en Cloudinary.`, { danger: true }))) return;
    try {
      await publicApi.del(`/products/${product._id}`);
      toast.success("Producto eliminado");
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  }

  // Subida rápida desde la card, sin abrir el modal de editar.
  async function handleAddImagesFromCard(product, files) {
    setUploadingId(product._id);
    try {
      await uploadImages(product._id, files);
      toast.success("Imagen agregada");
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  async function handleRemoveImage(publicId) {
    if (!editingId) return;
    setRemovingImage(publicId);
    try {
      await publicApi.del(`/products/${editingId}/images/${encodeURIComponent(publicId)}`);
      setForm((f) => ({ ...f, images: f.images.filter((img) => img.publicId !== publicId) }));
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRemovingImage(null);
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        {...getPageMeta("/catalogo")}
        actions={
          <>
            {PUBLIC_STORE_URL ? (
              <a href={PUBLIC_STORE_URL} target="_blank" rel="noreferrer" className={buttonClass("secondary", "header")}>
                <IconLink width={15} height={15} />
                Ver tienda pública
              </a>
            ) : null}
            <Button icon={IconPlus} onClick={openCreate}>
              Nuevo producto
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <KpiInline
          items={[
            { label: "Productos", value: fmtNumber(kpis.total), tone: "blue" },
            { label: "Activos", value: fmtNumber(kpis.active), tone: "green" },
            { label: "Destacados", value: fmtNumber(kpis.featured), tone: "amber" },
          ]}
        />
        <Tabs tabs={tabs} value={category === ALL ? ALL : category.toLowerCase()} onChange={setCategoryParam} />
      </div>

      <AsyncState
        loading={loading}
        error={error}
        empty={!loading && filtered.length === 0}
        emptyText={list.length ? "No hay productos en esta categoría." : "No hay productos todavía. Crea el primero con «Nuevo producto»."}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => (
            <ProductCatalogCard
              key={product._id}
              product={product}
              onEdit={openEdit}
              onDelete={handleDelete}
              onAddImages={handleAddImagesFromCard}
              uploading={uploadingId === product._id}
            />
          ))}
        </div>
      </AsyncState>

      <ProductFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingId={editingId}
        form={form}
        handleChange={handleChange}
        onToggleColor={toggleColor}
        onSubmit={handleSubmit}
        saving={saving}
        onRemoveImage={handleRemoveImage}
        removingImage={removingImage}
      />

      <ConfirmModal {...confirmProps} />
    </div>
  );
}

export default Catalogo;
