"use client";

/**
 * Common Components - Single Export Point
 * Flattened from atoms/molecules/organisms
 */

// Primitives
export { Button, type ButtonProps } from './Button';
export { Input } from './Input';
export { GranularInput } from './GranularInput';
export { SearchBar } from './SearchBar';
export { Label } from './Label';
export { Card, type CardProps } from './Card';
export { Checkbox } from './Checkbox';
export { Badge } from './Badge';
export { FieldGroup } from './FieldGroup';
export * from './Select';
export { GlobalSearch } from './GlobalSearch';
export { DeviationsSection } from './DeviationsSection';

// Typography
export {
    Title1,
    Title2,
    Title3,
    Body,
    Subhead,
    Caption1,
    Caption2,
    Mono,
    MonoCode,
    Accounting,
    SmallText,
    StandardLabel,
    StandardValue,
    MetricValue,
    TabLabel,
    TableTotal,
    Tiny,
    Mini,
    Micro
} from './Typography';

// Molecules
export { StatusBadge } from './StatusBadge';
export { Pagination } from './Pagination';
export { ToastProvider, useToast } from './Toast';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
export { Autocomplete } from './Autocomplete';
export { AsyncAutocomplete } from './AsyncAutocomplete';
export { EmptyState } from './EmptyState';
export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from './Dialog';
export { ActionConfirmationModal } from './ActionConfirmationModal';

// Atoms
export { MetadataItem, type MetadataItemProps } from './MetadataItem';

// Molecules (New Atomic Structure)
export { SummaryCard, type SummaryCardProps } from './SummaryCard';
export { SummaryCards, type SummaryCardsProps } from './SummaryCards';
export { SidebarNav } from './SidebarNav';

// Organisms
export { MetadataGrid } from './MetadataGrid';
export { ReconciliationChart } from './ReconciliationChart';
export { DataTable, type Column } from './DataTable';

// Layout
export { Box, Flex, Stack, Grid } from './Layout';

// Templates
export { DocumentTemplate } from './DocumentTemplate';
export { ThemeProvider } from './ThemeProvider';
export { ThemeToggle } from './ThemeToggle';

export { ListPageTemplate } from './ListPageTemplate';
export { FileUploadModal } from './FileUploadModal';
