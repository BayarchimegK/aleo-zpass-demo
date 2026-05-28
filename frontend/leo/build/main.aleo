program leo.aleo;

function prove_age_over_18:
    input r0 as u8.private;
    gte r0 18u8 into r1;
    output r1 as boolean.private;
