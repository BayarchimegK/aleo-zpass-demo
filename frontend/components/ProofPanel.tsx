interface Props {
  proof: string;
}

export default function ProofPanel({ proof }: Props) {
  if (!proof) {
    return null;
  }

  return (
    <div className="border rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold mb-4">ZK 증명</h2>

      <pre className="overflow-auto text-sm">{proof}</pre>
    </div>
  );
}
