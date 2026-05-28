export const verifyProof = async (
  proof: string
): Promise<boolean> => {

  try {
    const parsed = JSON.parse(proof);

    return parsed.publicOutput === true;

  } catch (err) {
    return false;
  }
};