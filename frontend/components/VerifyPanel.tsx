interface Props {
  result: string;
}

export default function VerifyPanel({ result }: Props) {
  if (!result) {
    return null;
  }

  return (
    <div className="border rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold mb-4">검증 결과</h2>

      <p className="text-xl font-bold">{result}</p>
    </div>
  );
}
