#ifndef COMMON_ENGINE_H
#define COMMON_ENGINE_H

#include <vector>
#include <cmath>
#include <cstdint>
#include <algorithm>
#include <random>

namespace pomai {

struct Point2D {
    float x;
    float y;
};

struct BoundingBox {
    float minX;
    float minY;
    float maxX;
    float maxY;
    float width;
    float height;
};

struct RGBColor {
    uint8_t r;
    uint8_t g;
    uint8_t b;
};

struct HSLColor {
    float h;
    float s;
    float l;
};

class CommonEngine {
public:
    static BoundingBox ComputeBounds(const std::vector<Point2D>& points);
    static std::vector<Point2D> TransformPoints(const std::vector<Point2D>& points, float angle, float cx, float cy);
    static Point2D GetGridPoint(float x, float y, float gridSize);
    static bool IsPointInBounds(float px, float py, const BoundingBox& bounds);
    
    // Color Processing
    static HSLColor RGBToHSL(uint8_t r, uint8_t g, uint8_t b);
    static RGBColor HSLToRGB(float h, float s, float l);
    static float GetLuminance(uint8_t r, uint8_t g, uint8_t b);
    static float GetContrastRatio(uint8_t r1, uint8_t g1, uint8_t b1, uint8_t r2, uint8_t g2, uint8_t b2);
    
    // Seeded Random Number Generator
    static uint32_t SeededRandom(uint32_t seed);
};

} // namespace pomai

#endif // COMMON_ENGINE_H
