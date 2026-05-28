program leo.aleo {

    // age is a PRIVATE input — it is never recorded on-chain.
    // The only public output is the boolean result (true / false).
    fn prove_age_over_18(
        private age: u8
    ) -> bool {
        return age >= 18u8;
    }
}