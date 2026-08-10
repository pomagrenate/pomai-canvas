#ifndef ELEMENT_ENGINE_H
#define ELEMENT_ENGINE_H

#include <vector>
#include <string>
#include <unordered_map>
#include <cmath>

namespace pomai_element {

struct Rect {
    float minX;
    float minY;
    float maxX;
    float maxY;
};

struct SpatialNode {
    std::string id;
    Rect bounds;
};

class SpatialIndex {
private:
    std::vector<SpatialNode> nodes;
public:
    void clear();
    void insert(const std::string& id, float minX, float minY, float maxX, float maxY);
    std::vector<std::string> queryBounds(const Rect& bounds) const;
    std::vector<std::string> queryPoint(float x, float y) const;
};

struct SceneNode {
    std::string id;
    Rect bounds;
};

class SceneGraph {
private:
    std::unordered_map<std::string, SceneNode> nodes;
public:
    void clear();
    void upsert(const std::string& id, float minX, float minY, float maxX, float maxY);
    void remove(const std::string& id);
    std::vector<SceneNode> getVisibleElements(const Rect& viewport) const;
    int getElementCount() const;
};

class Algorithms {
public:
    static int BucketFill(uint32_t* pixels, int width, int height, int startX, int startY, uint32_t fillColor, float tolerance);
};

} // namespace pomai_element

#endif // ELEMENT_ENGINE_H
