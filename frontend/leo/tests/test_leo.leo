// The 'test_leo' test program.
import leo.aleo;
program test_leo.aleo {
    @test
    @should_fail
    fn test_main_fails() {
        let result: u32 = leo.aleo::main(2u32, 3u32);
        assert_eq(result, 3u32);
    }

    @noupgrade
    constructor() {}
}
