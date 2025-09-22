/*
 * REAPER Web - JSFX Script Interpreter
 * Real-time audio effects scripting language based on REAPER's JSFX
 * Analyzed from actual REAPER JSFX scripts for compatibility
 */

#pragma once

#include <memory>
#include <vector>
#include <string>
#include <unordered_map>
#include <functional>
#include <stack>

// Forward declarations
class AudioBuffer;

/**
 * JSFX Variable - Dynamic type system like REAPER's JSFX
 * All variables are stored as double (64-bit float) like in REAPER
 */
class JSFXVariable {
public:
    JSFXVariable() : m_value(0.0) {}
    JSFXVariable(double value) : m_value(value) {}
    
    // Assignment and conversion
    JSFXVariable& operator=(double value) { m_value = value; return *this; }
    JSFXVariable& operator=(const JSFXVariable& other) { m_value = other.m_value; return *this; }
    
    // Arithmetic operators
    JSFXVariable operator+(const JSFXVariable& other) const { return JSFXVariable(m_value + other.m_value); }
    JSFXVariable operator-(const JSFXVariable& other) const { return JSFXVariable(m_value - other.m_value); }
    JSFXVariable operator*(const JSFXVariable& other) const { return JSFXVariable(m_value * other.m_value); }
    JSFXVariable operator/(const JSFXVariable& other) const { return JSFXVariable(m_value / other.m_value); }
    
    JSFXVariable& operator+=(const JSFXVariable& other) { m_value += other.m_value; return *this; }
    JSFXVariable& operator-=(const JSFXVariable& other) { m_value -= other.m_value; return *this; }
    JSFXVariable& operator*=(const JSFXVariable& other) { m_value *= other.m_value; return *this; }
    JSFXVariable& operator/=(const JSFXVariable& other) { m_value /= other.m_value; return *this; }
    
    // Comparison operators
    bool operator==(const JSFXVariable& other) const { return m_value == other.m_value; }
    bool operator!=(const JSFXVariable& other) const { return m_value != other.m_value; }
    bool operator<(const JSFXVariable& other) const { return m_value < other.m_value; }
    bool operator>(const JSFXVariable& other) const { return m_value > other.m_value; }
    bool operator<=(const JSFXVariable& other) const { return m_value <= other.m_value; }
    bool operator>=(const JSFXVariable& other) const { return m_value >= other.m_value; }
    
    // Type conversions
    operator double() const { return m_value; }
    operator float() const { return static_cast<float>(m_value); }
    operator int() const { return static_cast<int>(m_value); }
    operator bool() const { return m_value != 0.0; }
    
    // Array access (JSFX arrays are memory ranges)
    JSFXVariable& operator[](int index);
    const JSFXVariable& operator[](int index) const;
    
    double GetValue() const { return m_value; }
    void SetValue(double value) { m_value = value; }

private:
    double m_value;
};

/**
 * JSFX Memory Manager - Handles JSFX's memory model
 * JSFX uses a flat memory space for variables and arrays
 */
class JSFXMemory {
public:
    static constexpr int MEMORY_SIZE = 65536; // 64KB memory space like REAPER
    
    JSFXMemory();
    ~JSFXMemory();
    
    // Memory access
    JSFXVariable& GetVariable(int address);
    const JSFXVariable& GetVariable(int address) const;
    
    // Array operations
    void AllocateArray(const std::string& name, int size);
    int GetArrayAddress(const std::string& name) const;
    
    // Named variable access
    JSFXVariable& GetNamedVariable(const std::string& name);
    void SetNamedVariable(const std::string& name, double value);
    
    // Memory management
    void Clear();
    void Reset();
    
private:
    std::vector<JSFXVariable> m_memory;
    std::unordered_map<std::string, int> m_namedVariables;
    std::unordered_map<std::string, int> m_arrays;
    int m_nextFreeAddress;
};

/**
 * JSFX Built-in Functions - Math and audio processing functions
 * Based on REAPER's JSFX function library
 */
class JSFXBuiltins {
public:
    // Math functions
    static double sin(double x);
    static double cos(double x);
    static double tan(double x);
    static double asin(double x);
    static double acos(double x);
    static double atan(double x);
    static double atan2(double y, double x);
    static double exp(double x);
    static double log(double x);
    static double log10(double x);
    static double pow(double base, double exponent);
    static double sqrt(double x);
    static double abs(double x);
    static double floor(double x);
    static double ceil(double x);
    static double min(double a, double b);
    static double max(double a, double b);
    static double sign(double x);
    
    // Audio-specific functions
    static double db2gain(double db);
    static double gain2db(double gain);
    static double midi2freq(double note);
    static double freq2midi(double freq);
    
    // String functions (basic support)
    static double strcmp(const std::string& a, const std::string& b);
    static std::string sprintf(const std::string& format, const std::vector<double>& args);
};

/**
 * JSFX Token - Lexical analysis token
 */
enum class JSFXTokenType {
    UNKNOWN,
    IDENTIFIER,
    NUMBER,
    STRING,
    OPERATOR,
    PUNCTUATION,
    KEYWORD,
    COMMENT,
    NEWLINE,
    END_OF_FILE
};

struct JSFXToken {
    JSFXTokenType type;
    std::string value;
    int line;
    int column;
};

/**
 * JSFX Lexer - Tokenizes JSFX source code
 */
class JSFXLexer {
public:
    JSFXLexer(const std::string& source);
    
    JSFXToken NextToken();
    JSFXToken PeekToken();
    bool HasMoreTokens() const;
    
private:
    std::string m_source;
    size_t m_position;
    int m_line;
    int m_column;
    
    char GetChar();
    char PeekChar();
    void SkipWhitespace();
    JSFXToken ReadNumber();
    JSFXToken ReadString();
    JSFXToken ReadIdentifier();
    JSFXToken ReadOperator();
    bool IsAlpha(char c) const;
    bool IsDigit(char c) const;
    bool IsAlphaNumeric(char c) const;
};

/**
 * JSFX AST Node - Abstract Syntax Tree node
 */
enum class JSFXNodeType {
    PROGRAM,
    SECTION,           // @init, @slider, @sample, etc.
    ASSIGNMENT,
    BINARY_OP,
    UNARY_OP,
    FUNCTION_CALL,
    VARIABLE,
    NUMBER,
    STRING,
    ARRAY_ACCESS,
    IF_STATEMENT,
    WHILE_LOOP,
    BLOCK
};

class JSFXNode {
public:
    JSFXNodeType type;
    std::string value;
    std::vector<std::unique_ptr<JSFXNode>> children;
    
    JSFXNode(JSFXNodeType t, const std::string& v = "") : type(t), value(v) {}
    virtual ~JSFXNode() = default;
    
    void AddChild(std::unique_ptr<JSFXNode> child) {
        children.push_back(std::move(child));
    }
};

/**
 * JSFX Parser - Parses JSFX source into AST
 */
class JSFXParser {
public:
    JSFXParser(const std::string& source);
    
    std::unique_ptr<JSFXNode> Parse();
    
private:
    JSFXLexer m_lexer;
    JSFXToken m_currentToken;
    
    void Consume();
    void Expect(JSFXTokenType type);
    
    std::unique_ptr<JSFXNode> ParseProgram();
    std::unique_ptr<JSFXNode> ParseSection();
    std::unique_ptr<JSFXNode> ParseStatement();
    std::unique_ptr<JSFXNode> ParseExpression();
    std::unique_ptr<JSFXNode> ParseAssignment();
    std::unique_ptr<JSFXNode> ParseBinaryOp();
    std::unique_ptr<JSFXNode> ParseUnaryOp();
    std::unique_ptr<JSFXNode> ParseFunctionCall();
    std::unique_ptr<JSFXNode> ParsePrimary();
    std::unique_ptr<JSFXNode> ParseIfStatement();
    std::unique_ptr<JSFXNode> ParseWhileLoop();
    std::unique_ptr<JSFXNode> ParseBlock();
};

/**
 * JSFX Runtime Context - Execution context for JSFX scripts
 */
class JSFXContext {
public:
    JSFXContext();
    ~JSFXContext();
    
    // Built-in variables (REAPER globals)
    double srate = 48000.0;      // Sample rate
    double tempo = 120.0;        // Current tempo
    double beat_position = 0.0;  // Beat position
    double ts_num = 4.0;         // Time signature numerator
    double ts_denom = 4.0;       // Time signature denominator
    double play_state = 0.0;     // 0=stop, 1=play, 2=pause, 5=record
    double ext_tail_size = -1;   // Plugin tail size
    
    // Sample variables (updated each sample)
    double spl0 = 0.0;           // Left input/output
    double spl1 = 0.0;           // Right input/output
    double spl2 = 0.0;           // Additional channels
    double spl3 = 0.0;
    
    // Slider variables (parameters)
    std::vector<double> slider;  // slider1, slider2, etc.
    
    // Memory and variables
    JSFXMemory memory;
    
    // Function registry
    std::unordered_map<std::string, std::function<double(const std::vector<double>&)>> functions;
    
    // Register built-in functions
    void RegisterBuiltins();
    
    // Variable access
    JSFXVariable& GetVariable(const std::string& name);
    void SetVariable(const std::string& name, double value);
    
    // Function calls
    double CallFunction(const std::string& name, const std::vector<double>& args);
    
private:
    std::unordered_map<std::string, JSFXVariable> m_variables;
};

/**
 * JSFX Interpreter - Executes JSFX scripts
 */
class JSFXInterpreter {
public:
    JSFXInterpreter();
    ~JSFXInterpreter();
    
    // Script loading and compilation
    bool LoadScript(const std::string& source);
    bool LoadScriptFromFile(const std::string& filename);
    
    // Execution sections
    void ExecuteInit();
    void ExecuteSlider();
    void ExecuteSample(double inputL, double inputR, double& outputL, double& outputR);
    void ExecuteBlock(AudioBuffer& buffer);
    
    // Parameter management
    void SetParameter(int index, double value);
    double GetParameter(int index) const;
    int GetParameterCount() const;
    
    // Script information
    struct ScriptInfo {
        std::string description;
        std::string author;
        std::vector<std::string> tags;
        std::vector<std::string> inPins;
        std::vector<std::string> outPins;
        struct SliderInfo {
            std::string name;
            double defaultValue;
            double minValue;
            double maxValue;
            double step;
            std::vector<std::string> enumValues;
        };
        std::vector<SliderInfo> sliders;
    };
    
    const ScriptInfo& GetScriptInfo() const { return m_scriptInfo; }
    
    // Execution context
    JSFXContext& GetContext() { return m_context; }
    
    // Performance and debugging
    bool IsInitialized() const { return m_initialized; }
    double GetCpuUsage() const { return m_cpuUsage; }
    
private:
    std::unique_ptr<JSFXNode> m_ast;
    JSFXContext m_context;
    ScriptInfo m_scriptInfo;
    
    // Execution sections
    JSFXNode* m_initSection = nullptr;
    JSFXNode* m_sliderSection = nullptr;
    JSFXNode* m_sampleSection = nullptr;
    JSFXNode* m_blockSection = nullptr;
    JSFXNode* m_gfxSection = nullptr;
    
    bool m_initialized = false;
    double m_cpuUsage = 0.0;
    
    // Execution methods
    double ExecuteNode(JSFXNode* node);
    double ExecuteAssignment(JSFXNode* node);
    double ExecuteBinaryOp(JSFXNode* node);
    double ExecuteUnaryOp(JSFXNode* node);
    double ExecuteFunctionCall(JSFXNode* node);
    double ExecuteVariable(JSFXNode* node);
    double ExecuteNumber(JSFXNode* node);
    double ExecuteArrayAccess(JSFXNode* node);
    double ExecuteIfStatement(JSFXNode* node);
    double ExecuteWhileLoop(JSFXNode* node);
    double ExecuteBlock(JSFXNode* node);
    
    // Script parsing
    void ParseScriptHeader(const std::string& source);
    void FindSections();
    
    // Error handling
    void ReportError(const std::string& message);
    
    // Performance monitoring
    void UpdateCpuUsage(double executionTime);
};

/**
 * JSFX Effect - A complete JSFX effect instance
 * Combines interpreter with parameter management and I/O
 */
class JSFXEffect {
public:
    JSFXEffect();
    ~JSFXEffect();
    
    // Effect lifecycle
    bool LoadEffect(const std::string& source);
    bool LoadEffectFromFile(const std::string& filename);
    void Initialize(double sampleRate, int maxBlockSize);
    void Shutdown();
    
    // Audio processing
    void ProcessSample(double inputL, double inputR, double& outputL, double& outputR);
    void ProcessBlock(AudioBuffer& buffer);
    
    // Parameter automation
    void SetParameter(int index, double value);
    double GetParameter(int index) const;
    void SetParameterAutomation(int index, const std::vector<double>& values);
    
    // Effect information
    const JSFXInterpreter::ScriptInfo& GetInfo() const;
    const std::string& GetName() const { return m_name; }
    bool IsBypassed() const { return m_bypassed; }
    void SetBypassed(bool bypassed) { m_bypassed = bypassed; }
    
    // Performance
    double GetCpuUsage() const;
    bool IsInitialized() const { return m_initialized; }
    
private:
    std::unique_ptr<JSFXInterpreter> m_interpreter;
    std::string m_name;
    bool m_initialized = false;
    bool m_bypassed = false;
    double m_sampleRate = 48000.0;
    
    // Parameter automation
    struct ParameterAutomation {
        std::vector<double> values;
        size_t currentIndex = 0;
    };
    std::vector<ParameterAutomation> m_parameterAutomation;
    
    // Performance monitoring
    std::chrono::high_resolution_clock::time_point m_lastProcessTime;
    double m_averageCpuUsage = 0.0;
    
    void UpdateAutomation();
};