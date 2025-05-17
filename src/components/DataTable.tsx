import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "@/components/ui/table";

interface DataTableRow {
  heading: string;
  value: string;
}

interface DataTableProps {
  data: DataTableRow[];
  caption?: string;
}

export default function DataTable({ data, caption }: DataTableProps) {
  if (!data || data.length === 0) {
    return <p className="text-muted-foreground">No data to display.</p>;
  }

  return (
    <Table>
      {caption && <TableCaption>{caption}</TableCaption>}
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%] font-semibold">Heading</TableHead>
          <TableHead className="font-semibold">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, index) => (
          <TableRow key={index}>
            <TableCell className="font-medium">{row.heading}</TableCell>
            <TableCell>{row.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
