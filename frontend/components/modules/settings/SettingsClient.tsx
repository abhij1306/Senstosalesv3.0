"use client";

import { Body, Box, Button, Card, Flex, Grid, Input, Label, Stack, Title3, Caption1, Caption2, Subhead, DocumentTemplate, StandardLabel, StandardValue, FieldGroup, Tiny } from "@/components/common";

import React from "react";
import {
    Building2,
    Users,
    Settings2,
    Save,
    IndianRupee,
    Percent,
    Mail,
    MapPin,
    CreditCard,
    Plus,
    Trash2,
    X,
    Check,
    Edit2,
    Lock,
    Phone,
    FolderDown,
    ChevronDown,
    Calendar as CalendarIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, type Buyer as APIBuyer, type Settings } from "@/lib/api";
import { useSettingsStore } from "@/store/settingsStore";
import { useToast } from "@/components/common/Toast";

type SettingsSection = "supplier" | "buyers" | "system" | "downloads";

interface SettingsClientProps {
    initialSettings?: Settings | null;
    initialBuyers?: APIBuyer[];
    initialDownloadPrefs?: any;
}

export function SettingsClient({ initialSettings, initialBuyers, initialDownloadPrefs }: SettingsClientProps) {
    const [activeSection, setActiveSection] = React.useState<SettingsSection>("supplier");
    const {
        settings, fetchSettings, saveAll, isLoading: isGlobalLoading
    } = useSettingsStore();
    const { toast } = useToast();

    React.useEffect(() => {
        // Atomic hydration from props or single API call
        if (initialSettings && initialBuyers) {
            useSettingsStore.getState().hydrateSettings({
                settings: initialSettings,
                buyers: initialBuyers,
                download_prefs: initialDownloadPrefs || null
            });
        } else {
            useSettingsStore.getState().hydrateSettings();
        }
    }, []);

    const handleSaveAll = async () => {
        try {
            await saveAll();
            toast("Success", "All settings saved successfully", "success");
        } catch (error: any) {
            toast("Error", "Failed to save settings", "error");
        }
    };

    const navItems = [
        { id: "supplier", label: "Supplier Profile", icon: Building2 },
        { id: "buyers", label: "Buyer Management", icon: Users },
        { id: "system", label: "System Defaults", icon: Settings2 },
        { id: "downloads", label: "Download Folders", icon: FolderDown },
    ] as const;

    if (isGlobalLoading && !settings) {
        return (
            <div className="h-[600px] flex items-center justify-center bg-surface-nav text-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="w-16 h-16 rounded-[2rem] bg-surface shadow-tahoe-elevated flex items-center justify-center glass border border-border-default">
                        <Plus className="animate-spin text-action-primary" size={32} />
                    </div>
                    <Subhead className="animate-pulse">Initializing System Prefs...</Subhead>
                </div>
            </div>
        );
    }

    return (
        <DocumentTemplate
            title="Settings & Master Data"
            description="Configure organization identity, buyer relationships, and system defaults"
            icon={<Settings2 size={22} />}
            actions={
                <Button
                    variant="primary"
                    onClick={handleSaveAll}
                    disabled={isGlobalLoading}
                    className="shadow-lg shadow-action-primary/25"
                >
                    {isGlobalLoading ? <Plus className="animate-spin" /> : <Save size={18} />}
                    Save Changes
                </Button>
            }
        >
            <div className="flex flex-col lg:flex-row gap-8 pb-8">
                {/* Left Sidebar Navigation */}
                <aside className="w-full lg:w-72 shrink-0">
                    <div className="bg-surface shadow-sm p-4 space-y-1 sticky top-8 rounded-2xl">
                        <div className="px-4 py-2 mb-2">
                            <p className="text-text-tertiary font-bold uppercase tracking-widest text-[10px]">System Core</p>
                        </div>
                        {navItems.map((item) => (
                            <Button
                                key={item.id}
                                variant="ghost"
                                onClick={() => setActiveSection(item.id)}
                                className={cn(
                                    "w-full justify-between gap-3 rounded-xl h-11 transition-all duration-300 group relative px-4 border-none shadow-none",
                                    activeSection === item.id
                                        ? "text-action-primary bg-action-primary-container font-bold shadow-none"
                                        : "text-text-secondary hover:bg-surface-secondary"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon size={18} className={cn(activeSection === item.id ? "text-action-primary" : "opacity-60 group-hover:opacity-100 group-hover:text-action-primary")} />
                                    <span className="text-sm uppercase tracking-wide">{item.label}</span>
                                </div>
                                {activeSection === item.id && <ChevronDown size={14} className="-rotate-90" />}
                            </Button>
                        ))}
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    <div className="bg-surface rounded-2xl shadow-sm overflow-hidden">
                        {activeSection === "supplier" && <SupplierSection />}
                        {activeSection === "buyers" && <BuyersSection />}
                        {activeSection === "system" && <SystemSection />}
                        {activeSection === "downloads" && <DownloadPrefsSection />}
                    </div>
                </div>
            </div>
        </DocumentTemplate>
    );
}

const SupplierSection = React.memo(() => {
    const settings = useSettingsStore(s => s.settings);
    const update = useSettingsStore(s => s.updateSettings);

    if (!settings) return null;

    return (
        <div className="p-8">
            <Stack gap={8}>
                <div className="mb-2 border-b border-border-subtle/50 pb-6">
                    <Title3>Organization Identity</Title3>
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1">Legal Entity Parameters</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-4">
                    <FieldGroup
                        label="Registered Entity Name"
                        value={settings.supplier_name || ""}
                        onChange={(v) => update({ supplier_name: v })}
                        icon={<Building2 size={14} />}
                        placeholder="e.g. Acme Industries Ltd."
                    />
                    <FieldGroup
                        label="Phone Number"
                        value={settings.supplier_contact || ""}
                        onChange={(v) => update({ supplier_contact: v })}
                        icon={<Phone size={14} />}
                        placeholder="+91 98765 43210"
                    />
                    <FieldGroup
                        label="Primary Email"
                        value={settings.supplier_email || ""}
                        onChange={(v) => update({ supplier_email: v })}
                        placeholder="billing@company.com"
                        icon={<Mail size={14} />}
                    />
                    <FieldGroup
                        label="GSTIN (Tax ID)"
                        value={settings.supplier_gstin || ""}
                        onChange={(v) => update({ supplier_gstin: v })}
                        icon={<Percent size={14} />}
                        placeholder="27ABCDE1234F1Z5"
                    />
                    <FieldGroup
                        label="PAN Number"
                        value={settings.pan_number || ""}
                        onChange={(v) => update({ pan_number: v })}
                        icon={<CreditCard size={14} />}
                        placeholder="ABCDE1234F"
                    />
                    <div className="md:col-span-1">
                        <FieldGroup
                            label="Registered Address"
                            isTextArea
                            value={settings.supplier_address || ""}
                            onChange={(v) => update({ supplier_address: v })}
                            icon={<MapPin size={14} />}
                            placeholder="Full registered address..."
                        />
                    </div>
                </div>
            </Stack>
        </div>
    );
});

const BuyersSection = React.memo(() => {
    const { buyers, saveBuyer, deleteBuyer, setBuyerDefault } = useSettingsStore();
    const { toast } = useToast();
    const [editingBuyer, setEditingBuyer] = React.useState<APIBuyer | Partial<APIBuyer> | null>(null);

    const handleDelete = async (id: number) => {
        if (confirm("Are you sure you want to delete this buyer?")) {
            try {
                await deleteBuyer(id);
                toast("Success", "Buyer deleted", "success");
            } catch (error) {
                toast("Error", "Failed to delete buyer", "error");
            }
        }
    };

    const handleSaveBuyer = async () => {
        if (!editingBuyer || !editingBuyer.name || !editingBuyer.gstin) {
            toast("Error", "Name and GSTIN are required", "error");
            return;
        }
        try {
            await saveBuyer(editingBuyer);
            toast("Success", editingBuyer.id ? "Updated" : "Created", "success");
            setEditingBuyer(null);
        } catch (error) {
            toast("Error", "Failed to save buyer", "error");
        }
    };

    return (
        <div className="p-8 space-y-8">
            <div className="flex items-center justify-between border-b border-border-subtle/50 pb-6">
                <div className="space-y-1">
                    <Title3>Buyer Management</Title3>
                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-1">PSU Division Control</p>
                </div>
                <Button
                    variant="primary"
                    onClick={() => setEditingBuyer({ name: "", gstin: "", billing_address: "", place_of_supply: "", is_default: false })}
                    className="shadow-md shadow-action-primary/20"
                >
                    <Plus size={16} />
                    Add Buyer
                </Button>
            </div>

            {editingBuyer && (
                <Card padding="md" className="border border-border-subtle bg-surface-sunken/40 rounded-2xl shadow-sm">
                    <Stack gap={4}>
                        <Flex align="center" justify="between" className="border-b border-border-subtle pb-3">
                            <Flex align="center" gap={2}>
                                <Building2 size={16} className="text-action-primary" />
                                <StandardValue className="font-bold">{editingBuyer.id ? "Edit Buyer Profile" : "New Buyer Profile"}</StandardValue>
                            </Flex>
                            <Button variant="ghost" size="compact" onClick={() => setEditingBuyer(null)} className="w-7 h-7 rounded-full p-0">
                                <X size={16} />
                            </Button>
                        </Flex>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FieldGroup
                                label="Buyer Name"
                                value={editingBuyer.name || ""}
                                onChange={(v) => setEditingBuyer({ ...editingBuyer, name: v })}
                                icon={<Building2 size={14} />}
                                placeholder="e.g. Global PSU Site"
                            />
                            <FieldGroup
                                label="Buyer GSTIN"
                                value={editingBuyer.gstin || ""}
                                onChange={(v) => setEditingBuyer({ ...editingBuyer, gstin: v })}
                                icon={<Percent size={14} />}
                                placeholder="33AAACB1234C1Z1"
                            />
                            <FieldGroup
                                label="Place of Supply"
                                value={editingBuyer.place_of_supply || ""}
                                onChange={(v) => setEditingBuyer({ ...editingBuyer, place_of_supply: v })}
                                icon={<MapPin size={14} />}
                                placeholder="Tamil Nadu"
                            />
                            <div className="md:col-span-2">
                                <FieldGroup
                                    label="Billing Address"
                                    isTextArea
                                    value={(editingBuyer as any).billing_address || ""}
                                    onChange={(v) => setEditingBuyer({ ...editingBuyer, billing_address: v })}
                                    icon={<MapPin size={14} />}
                                    placeholder="Full billing address..."
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-2 px-1">
                                <Input
                                    id="is-default"
                                    type="checkbox"
                                    checked={editingBuyer.is_default}
                                    onChange={(e) => setEditingBuyer({ ...editingBuyer, is_default: e.target.checked })}
                                    className="h-4 w-4 rounded border-border-default text-action-primary focus:ring-action-primary bg-transparent"
                                />
                                <Label htmlFor="is-default" className="text-xs font-medium uppercase tracking-[0.1em] text-text-tertiary antialiased cursor-pointer">Primary default</Label>
                            </div>
                        </div>

                        <Flex gap={2} justify="end" className="pt-3 border-t border-border-subtle">
                            <Button variant="ghost" size="compact" onClick={() => setEditingBuyer(null)}>Cancel</Button>
                            <Button variant="primary" size="compact" onClick={handleSaveBuyer}>
                                <Save size={14} className="mr-2" />
                                Save
                            </Button>
                        </Flex>
                    </Stack>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.isArray(buyers) && buyers.length > 0 ? (
                    buyers.map((buyer) => (
                        <div key={buyer.id} className={cn(
                            "bg-surface rounded-2xl border border-border-subtle p-5 group relative overflow-hidden transition-all duration-300",
                            buyer.is_default ? "bg-action-primary/[0.02] border-action-primary/20 ring-1 ring-action-primary/5" : "shadow-sm hover:shadow-md"
                        )}>
                            {!!buyer.is_default && (
                                <div className="absolute top-0 right-0">
                                    <span className="bg-action-primary text-white px-3 py-1 rounded-bl-xl">
                                        <Tiny>PRIMARY</Tiny>
                                    </span>
                                </div>
                            )}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "size-10 rounded-lg flex items-center justify-center border",
                                        buyer.is_default ? "bg-action-primary text-white border-action-primary/20" : "bg-surface-sunken text-action-primary border-border-subtle"
                                    )}>
                                        <Building2 size={18} />
                                    </div>
                                    <div className="space-y-0">
                                        <StandardValue className="tracking-tight truncate max-w-[180px]">
                                            {buyer.name}
                                        </StandardValue>
                                        <Caption1 className="opacity-60">
                                            {buyer.gstin}
                                        </Caption1>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <MapPin size={12} className="text-text-tertiary shrink-0" />
                                    <Caption1 className="leading-tight line-clamp-1 opacity-70">{buyer.billing_address || "No address"}</Caption1>
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-border-subtle mt-auto">
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="checkbox"
                                            checked={!!buyer.is_default}
                                            onChange={() => setBuyerDefault(buyer.id)}
                                            className="h-3.5 w-3.5 rounded-full border-border-subtle text-action-primary"
                                        />
                                        <Caption1 className="opacity-40">Default</Caption1>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="compact"
                                            onClick={() => setEditingBuyer(buyer)}
                                            className="size-7 rounded-md hover:bg-surface-secondary hover:text-action-primary transition-all"
                                        >
                                            <Edit2 size={12} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="compact"
                                            onClick={() => handleDelete(buyer.id)}
                                            className="size-7 rounded-md hover:bg-status-error/10 hover:text-status-error transition-all"
                                        >
                                            <Trash2 size={12} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="md:col-span-2 p-10 text-center bg-surface-sunken/40 rounded-2xl border border-border-subtle shadow-sm">
                        <Users size={32} className="mx-auto text-text-tertiary opacity-20 mb-2" />
                        <Caption1 className="opacity-30">No Buyers Found</Caption1>
                    </div>
                )}
            </div>
        </div >
    );
});

const SystemSection = React.memo(() => {
    const settings = useSettingsStore(s => s.settings);
    const update = useSettingsStore(s => s.updateSettings);

    if (!settings) return null;

    return (
        <div className="p-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-surface border border-border-subtle shadow-sm rounded-xl overflow-hidden relative p-6 h-fit">
                <Stack gap={6}>
                    <div className="mb-2 border-b border-border-subtle pb-5 flex items-center gap-4">
                        <div className="size-10 rounded-lg bg-action-primary-container flex items-center justify-center text-action-primary">
                            <Settings2 size={20} />
                        </div>
                        <div className="space-y-1">
                            <Title3>System Defaults</Title3>
                            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-0.5">Regional & UI Parameters</p>
                        </div>
                    </div>

                    <div className="space-y-5 pt-1">
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest ml-1">Base Currency</p>
                            <div className="relative group">
                                <IndianRupee size={16} className="absolute left-3 top-[13px] text-text-quaternary group-focus-within:text-action-primary transition-colors z-10" />
                                <select className="w-full h-11 pl-10 pr-10 rounded-xl border border-border-default bg-surface-sunken/60 text-sm font-semibold text-text-primary focus:ring-2 focus:ring-action-primary/10 focus:border-action-primary outline-none appearance-none transition-all">
                                    <option>INR - Indian Rupee</option>
                                    <option>USD - US Dollar</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-[13px] w-4 h-4 text-text-quaternary pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest ml-1">Fiscal Year Cycle</p>
                            <div className="relative group">
                                <CalendarIcon size={16} className="absolute left-3 top-[13px] text-text-quaternary group-focus-within:text-action-primary transition-colors z-10" />
                                <select className="w-full h-11 pl-10 pr-10 rounded-xl border border-border-default bg-surface-sunken/60 text-sm font-semibold text-text-primary focus:ring-2 focus:ring-action-primary/10 focus:border-action-primary outline-none appearance-none transition-all">
                                    <option>April - March (India)</option>
                                    <option>January - December</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-[13px] w-4 h-4 text-text-quaternary pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </Stack>
            </div>

            <div className="bg-surface shadow-sm rounded-[1.5rem] overflow-hidden relative p-6 h-fit">
                <Stack gap={4}>
                    <Flex align="center" gap={4} className="border-b border-border-subtle/10 pb-4">
                        <div className="size-10 rounded-lg bg-status-warning/10 flex items-center justify-center text-status-warning">
                            <Percent size={20} />
                        </div>
                        <div className="space-y-0.5">
                            <Title3>Tax Configuration</Title3>
                            <Caption1 className="opacity-40">GST and Tax Split Logic</Caption1>
                        </div>
                    </Flex>

                    <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1 text-center">
                                <StandardLabel className="px-1 opacity-40">IGST %</StandardLabel>
                                <Input
                                    type="number"
                                    value={settings.igst_rate ?? "18"}
                                    onChange={(e) => update({ igst_rate: e.target.value })}
                                    className="w-full h-9 px-2 rounded-lg border border-border-default bg-surface-sunken/60 border-border-default/40 text-sm font-black text-action-primary outline-none text-center font-mono"
                                />
                            </div>
                            <div className="space-y-1 text-center">
                                <StandardLabel className="px-1 opacity-40">CGST %</StandardLabel>
                                <Input
                                    type="number"
                                    value={settings.cgst_rate ?? "9"}
                                    onChange={(e) => update({ cgst_rate: e.target.value })}
                                    className="w-full h-9 px-2 rounded-lg border border-border-default bg-surface-sunken/60 border-border-default/40 text-sm font-black text-action-primary outline-none text-center font-mono"
                                />
                            </div>
                            <div className="space-y-1 text-center">
                                <StandardLabel className="px-1 opacity-40">SGST %</StandardLabel>
                                <Input
                                    type="number"
                                    value={settings.sgst_rate ?? "9"}
                                    onChange={(e) => update({ sgst_rate: e.target.value })}
                                    className="w-full h-9 px-2 rounded-lg border border-border-default bg-surface-sunken/60 border-border-default/40 text-sm font-black text-action-primary outline-none text-center font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </Stack>
            </div>
        </div>
    );
});

const DownloadPrefsSection = React.memo(() => {
    const { downloadPrefs: prefs, updateDownloadPrefs: update, pickFolderPath, isLoading } = useSettingsStore();

    if (isLoading && !prefs) return (
        <div className="h-[400px] flex items-center justify-center">
            <Plus className="animate-spin text-action-primary/30" size={32} />
        </div>
    );

    const safePrefs = prefs || {} as any;

    const fields = [
        { key: "po_html", label: "PO (HTML)", placeholder: "C:\\Downloads\\PO" },
        { key: "srv_html", label: "SRV (HTML)", placeholder: "C:\\Downloads\\SRV" },
        { key: "challan", label: "Challans", placeholder: "C:\\Downloads\\Challan" },
        { key: "gc", label: "GCs", placeholder: "C:\\Downloads\\GC" },
        { key: "invoice", label: "Invoices", placeholder: "C:\\Downloads\\Invoice" },
        { key: "challan_summary", label: "Challan Reg", placeholder: "C:\\Downloads\\Summary" },
        { key: "invoice_summary", label: "Invoice Reg", placeholder: "C:\\Downloads\\Summary" },
        { key: "items_summary", label: "Items Sum", placeholder: "C:\\Downloads\\Summary" },
    ] as const;

    return (
        <div className="p-8">
            <Stack gap={6}>
                <div className="mb-2 border-b border-border-subtle/50 pb-6 flex items-center gap-4">
                    <div className="size-10 rounded-lg bg-action-primary-container flex items-center justify-center text-action-primary">
                        <FolderDown size={20} />
                    </div>
                    <div className="space-y-1">
                        <Title3>Download Destinations</Title3>
                        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest mt-0.5">Automated Export Control</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-y-4 w-full">
                    {fields.map((field) => (
                        <div key={field.key} className="flex gap-2 items-end group/item">
                            <div className="flex-1">
                                <FieldGroup
                                    label={field.label}
                                    value={safePrefs[field.key] || ""}
                                    onChange={(v) => update({ [field.key]: v })}
                                    icon={<FolderDown size={14} />}
                                    placeholder={field.placeholder}
                                    className="w-full"
                                />
                            </div>
                            <Button
                                variant="secondary"
                                onClick={() => pickFolderPath(field.key)}
                                className="h-11 px-3 mb-[2px] rounded-xl border border-border-subtle hover:bg-surface-secondary shadow-sm transition-all active:scale-95 shrink-0"
                            >
                                <span className="font-bold text-lg leading-none mt-[-4px]">...</span>
                            </Button>
                        </div>
                    ))}
                </div>
            </Stack>
        </div>
    );
});
