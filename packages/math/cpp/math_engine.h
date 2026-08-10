#ifndef MATH_ENGINE_H
#define MATH_ENGINE_H

#include <vector>
#include <cmath>

namespace pomai_math {

struct Point2D {
    float x;
    float y;
};

struct Bounds {
    float minX;
    float minY;
    float maxX;
    float maxY;
};

class MathEngine {
public:
    // PCA
    static float CalculatePCA(const std::vector<Point2D>& points);
    
    // Polygon Raycasting
    static bool IsPointInPolygon(const Point2D& p, const std::vector<Point2D>& polygon);

    // Ellipse Hit Test
    static bool IsPointInEllipse(const Point2D& p, const Point2D& center, float rx, float ry, float angle);

    // Bezier Curves (Quadratic/Cubic evaluations)
    static std::vector<Point2D> GetBezierPoints(const std::vector<Point2D>& controlPoints, int numSegments);
};

} // namespace pomai_math

#endif // MATH_ENGINE_H
