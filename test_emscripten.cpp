#include <iostream>
#include <emscripten.h>

extern "C" {
    EMSCRIPTEN_KEEPALIVE
    int add(int a, int b) {
        return a + b;
    }
    
    EMSCRIPTEN_KEEPALIVE
    double multiply(double x, double y) {
        return x * y;
    }
}

int main() {
    std::cout << "Hello from Emscripten C++!" << std::endl;
    std::cout << "5 + 3 = " << add(5, 3) << std::endl;
    std::cout << "2.5 * 4.0 = " << multiply(2.5, 4.0) << std::endl;
    return 0;
}