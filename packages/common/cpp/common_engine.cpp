#include "common_engine.h"
#include <emscripten/emscripten.h>

namespace pomai {

BoundingBox CommonEngine::ComputeBounds(const std::vector<Point2D>& points) {
    if (points.empty()) {
        return {0.0f, 0.0f, 0.0f, 0.0f, 0.0f, 0.0f};
    }

    float minX = points[0].x;
    float minY = points[0].y;
    float maxX = points[0].x;
    float maxY = points[0].y;

    for (size_t i = 1; i < points.size(); ++i) {
        if (points[i].x < minX) minX = points[i].x;
        if (points[i].y < minY) minY = points[i].y;
        if (points[i].x > maxX) maxX = points[i].x;
        if (points[i].y > maxY) maxY = points[i].y;
    }

    return {minX, minY, maxX, maxY, maxX - minX, maxY - minY};
}

std::vector<Point2D> CommonEngine::TransformPoints(const std::vector<Point2D>& points, float angle, float cx, float cy) {
    if (angle == 0.0f || points.empty()) {
        return points;
    }

    float cosAngle = std::cos(angle);
    float sinAngle = std::sin(angle);
    std::vector<Point2D> result(points.size());

    for (size_t i = 0; i < points.size(); ++i) {
        float dx = points[i].x - cx;
        float dy = points[i].y - cy;
        result[i] = {
            cx + dx * cosAngle - dy * sinAngle,
            cy + dx * sinAngle + dy * cosAngle
        };
    }

    return result;
}

Point2D CommonEngine::GetGridPoint(float x, float y, float gridSize) {
    if (gridSize > 0.0f) {
        return {
            std::round(x / gridSize) * gridSize,
            std::round(y / gridSize) * gridSize
        };
    }
    return {x, y};
}

bool CommonEngine::IsPointInBounds(float px, float py, const BoundingBox& bounds) {
    return px >= bounds.minX && px <= bounds.maxX && py >= bounds.minY && py <= bounds.maxY;
}

HSLColor CommonEngine::RGBToHSL(uint8_t r, uint8_t g, uint8_t b) {
    float rf = r / 255.0f;
    float gf = g / 255.0f;
    float bf = b / 255.0f;

    float maxVal = std::max({rf, gf, bf});
    float minVal = std::min({rf, gf, bf});
    float delta = maxVal - minVal;

    float h = 0.0f;
    float s = 0.0f;
    float l = (maxVal + minVal) / 2.0f;

    if (delta > 0.00001f) {
        s = l > 0.5f ? delta / (2.0f - maxVal - minVal) : delta / (maxVal + minVal);

        if (maxVal == rf) {
            h = (gf - bf) / delta + (gf < bf ? 6.0f : 0.0f);
        } else if (maxVal == gf) {
            h = (bf - rf) / delta + 2.0f;
        } else {
            h = (rf - gf) / delta + 4.0f;
        }
        h /= 6.0f;
    }

    return {h * 360.0f, s * 100.0f, l * 100.0f};
}

RGBColor CommonEngine::HSLToRGB(float h, float s, float l) {
    h /= 360.0f;
    s /= 100.0f;
    l /= 100.0f;

    float r, g, b;

    if (s == 0.0f) {
        r = g = b = l;
    } else {
        auto hue2rgb = [](float p, float q, float t) {
            if (t < 0.0f) t += 1.0f;
            if (t > 1.0f) t -= 1.0f;
            if (t < 1.0f / 6.0f) return p + (q - p) * 6.0f * t;
            if (t < 1.0f / 2.0f) return q;
            if (t < 2.0f / 3.0f) return p + (q - p) * (2.0f / 3.0f - t) * 6.0f;
            return p;
        };

        float q = l < 0.5f ? l * (1.0f + s) : l + s - l * s;
        float p = 2.0f * l - q;
        r = hue2rgb(p, q, h + 1.0f / 3.0f);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1.0f / 3.0f);
    }

    return {
        static_cast<uint8_t>(std::round(r * 255.0f)),
        static_cast<uint8_t>(std::round(g * 255.0f)),
        static_cast<uint8_t>(std::round(b * 255.0f))
    };
}

float CommonEngine::GetLuminance(uint8_t r, uint8_t g, uint8_t b) {
    auto transform = [](float c) {
        c /= 255.0f;
        return c <= 0.03928f ? c / 12.92f : std::pow((c + 0.055f) / 1.055f, 2.4f);
    };

    return 0.2126f * transform(r) + 0.7152f * transform(g) + 0.0722f * transform(b);
}

float CommonEngine::GetContrastRatio(uint8_t r1, uint8_t g1, uint8_t b1, uint8_t r2, uint8_t g2, uint8_t b2) {
    float l1 = GetLuminance(r1, g1, b1);
    float l2 = GetLuminance(r2, g2, b2);

    float maxL = std::max(l1, l2);
    float minL = std::min(l1, l2);

    return (maxL + 0.05f) / (minL + 0.05f);
}

uint32_t CommonEngine::SeededRandom(uint32_t seed) {
    std::mt19937 gen(seed);
    return gen();
}

} // namespace pomai

extern "C" {

EMSCRIPTEN_KEEPALIVE
void pomai_common_compute_bounds(float* pointsArray, int pointCount, float* outBounds) {
    std::vector<pomai::Point2D> pts(pointCount);
    for (int i = 0; i < pointCount; ++i) {
        pts[i] = {pointsArray[i * 2], pointsArray[i * 2 + 1]};
    }
    auto b = pomai::CommonEngine::ComputeBounds(pts);
    outBounds[0] = b.minX;
    outBounds[1] = b.minY;
    outBounds[2] = b.maxX;
    outBounds[3] = b.maxY;
    outBounds[4] = b.width;
    outBounds[5] = b.height;
}

EMSCRIPTEN_KEEPALIVE
void pomai_common_rgb_to_hsl(uint8_t r, uint8_t g, uint8_t b, float* outHsl) {
    auto hsl = pomai::CommonEngine::RGBToHSL(r, g, b);
    outHsl[0] = hsl.h;
    outHsl[1] = hsl.s;
    outHsl[2] = hsl.l;
}

EMSCRIPTEN_KEEPALIVE
float pomai_common_contrast_ratio(uint8_t r1, uint8_t g1, uint8_t b1, uint8_t r2, uint8_t g2, uint8_t b2) {
    return pomai::CommonEngine::GetContrastRatio(r1, g1, b1, r2, g2, b2);
}

}
