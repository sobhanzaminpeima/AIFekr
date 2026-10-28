import CustomerProfile from "@/components/admin/growth/CustomerProfile";
export const dynamic = "force-dynamic";
export default async function Page(props: { params: Promise<{ id: string }> }) { const { id } = await props.params; return <CustomerProfile userId={id}/>; }
