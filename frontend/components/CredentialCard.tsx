interface Props {
  credential: any;
}

export default function CredentialCard({ credential }: Props) {
  if (!credential) {
    return null;
  }

  return (
    <div className="border rounded-lg p-6 mt-6">
      <h2 className="text-2xl font-bold mb-4">자격 증명</h2>

      <div className="space-y-2">
        <p>
          <strong>이메일:</strong> {credential.holderEmail}
        </p>

        <p>
          <strong>국가:</strong> {credential.country}
        </p>

        <p>
          <strong>나이:</strong> {credential.age}
        </p>
      </div>
    </div>
  );
}
