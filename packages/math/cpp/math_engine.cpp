#include "math_engine.h"
#include <emscripten/emscripten.h>

namespace pomai_math {

float MathEngine::CalculatePCA(const std::vector<Point2D>& points) {
    if (points.empty()) return 0.0f;

    float sumX = 0.0f, sumY = 0.0f;
    for (const auto& p : points) {
        sumX += p.x;
        sumY += p.y;
    }
    float meanX = sumX / points.size();
    float meanY = sumY / points.size();

    float covXX = 0.0f, covXY = 0.0f, covYY = 0.0f;
    for (const auto& p : points) {
        float dx = p.x - meanX;
        float dy = p.y - meanY;
        covXX += dx * dx;
        covXY += dx * dy;
        covYY += dy * dy;
    }

    covXX /= points.size();
    covXY /= points.size();
    covYY /= points.size();

    float trace = covXX + covYY;
    float det = covXX * covYY - covXY * covXY;
    float lambda1 = (trace + std::sqrt(trace * trace - 4 * det)) / 2.0f;
    float lambda2 = (trace - std::sqrt(trace * trace - 4 * det)) / 2.0f;

    float angle = 0.0f;
    if (covXY != 0.0f) {
        angle = std::atan2(lambda1 - covXX, covXY);
    } else {
        angle = covXX > covYY ? 0.0f : M_PI / 2.0f;
    }
    return angle;
}

bool MathEngine::IsPointInPolygon(const Point2D& p, const std::vector<Point2D>& polygon) {
    bool inside = false;
    for (size_t i = 0, j = polygon.size() - 1; i < polygon.size(); j = i++) {
        if (((polygon[i].y > p.y) != (polygon[j].y > p.y)) &&
            (p.x < (polygon[j].x - polygon[i].x) * (p.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
            inside = !inside;
        }
    }
    return inside;
}

bool MathEngine::IsPointInEllipse(const Point2D& p, const Point2D& center, float rx, float ry, float angle) {
    float cosAngle = std::cos(-angle);
    float sinAngle = std::sin(-angle);
    
    float dx = p.x - center.x;
    float dy = p.y - center.y;
    
    float tX = dx * cosAngle - dy * sinAngle;
    float tY = dx * sinAngle + dy * cosAngle;
    
    return (tX * tX) / (rx * rx) + (tY * tY) / (ry * ry) <= 1.0f;
}

std::vector<Point2D> MathEngine::GetBezierPoints(const std::vector<Point2D>& controlPoints, int numSegments) {
    std::vector<Point2D> result;
    if (controlPoints.size() != 3 && controlPoints.size() != 4) return result;

    result.reserve(numSegments + 1);
    
    for (int i = 0; i <= numSegments; ++i) {
        float t = static_cast<float>(i) / numSegments;
        float u = 1.0f - t;

        if (controlPoints.size() == 3) {
            float x = u * u * controlPoints[0].x + 2 * u * t * controlPoints[1].x + t * t * controlPoints[2].x;
            float y = u * u * controlPoints[0].y + 2 * u * t * controlPoints[1].y + t * t * controlPoints[2].y;
            result.push_back({x, y});
        } else if (controlPoints.size() == 4) {
            float x = u * u * u * controlPoints[0].x + 3 * u * u * t * controlPoints[1].x + 3 * u * t * t * controlPoints[2].x + t * t * t * controlPoints[3].x;
            float y = u * u * u * controlPoints[0].y + 3 * u * u * t * controlPoints[1].y + 3 * u * t * t * controlPoints[2].y + t * t * t * controlPoints[3].y;
            result.push_back({x, y});
        }
    }
    
    return result;
}

} // namespace pomai_math

extern "C" {

EMSCRIPTEN_KEEPALIVE
float pomai_math_pca(float* pointsArray, int pointCount) {
    std::vector<pomai_math::Point2D> pts(pointCount);
    for (int i = 0; i < pointCount; ++i) {
        pts[i] = {pointsArray[i * 2], pointsArray[i * 2 + 1]};
    }
    return pomai_math::MathEngine::CalculatePCA(pts);
}

EMSCRIPTEN_KEEPALIVE
int pomai_math_point_in_polygon(float px, float py, float* polygonArray, int pointCount) {
    std::vector<pomai_math::Point2D> poly(pointCount);
    for (int i = 0; i < pointCount; ++i) {
        poly[i] = {polygonArray[i * 2], polygonArray[i * 2 + 1]};
    }
    return pomai_math::MathEngine::IsPointInPolygon({px, py}, poly) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int pomai_math_point_in_ellipse(float px, float py, float cx, float cy, float rx, float ry, float angle) {
    return pomai_math::MathEngine::IsPointInEllipse({px, py}, {cx, cy}, rx, ry, angle) ? 1 : 0;
}

}
