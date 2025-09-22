/*
 * REAPER Web - JSFX Script Interpreter Implementation
 * Real-time audio effects scripting language based on REAPER's JSFX
 */

#include "jsfx_interpreter.hpp"
#include "../core/audio_buffer.hpp"
#include <cmath>
#include <algorithm>
#include <chrono>
#include <sstream>
#include <regex>

// JSFXVariable Implementation
JSFXVariable& JSFXVariable::operator[](int index) {
    // This would access global memory space - simplified for now
    static JSFXVariable dummy;
    return dummy;
}

const JSFXVariable& JSFXVariable::operator[](int index) const {
    static JSFXVariable dummy;
    return dummy;
}

// JSFXMemory Implementation
JSFXMemory::JSFXMemory() : m_nextFreeAddress(0) {
    m_memory.resize(MEMORY_SIZE);
}

JSFXMemory::~JSFXMemory() = default;

JSFXVariable& JSFXMemory::GetVariable(int address) {
    if (address >= 0 && address < MEMORY_SIZE) {
        return m_memory[address];
    }
    static JSFXVariable dummy;
    return dummy;
}

const JSFXVariable& JSFXMemory::GetVariable(int address) const {
    if (address >= 0 && address < MEMORY_SIZE) {
        return m_memory[address];
    }
    static JSFXVariable dummy;
    return dummy;
}

void JSFXMemory::AllocateArray(const std::string& name, int size) {
    if (m_nextFreeAddress + size < MEMORY_SIZE) {
        m_arrays[name] = m_nextFreeAddress;
        m_nextFreeAddress += size;
    }
}

int JSFXMemory::GetArrayAddress(const std::string& name) const {
    auto it = m_arrays.find(name);
    return (it != m_arrays.end()) ? it->second : -1;
}

JSFXVariable& JSFXMemory::GetNamedVariable(const std::string& name) {
    auto it = m_namedVariables.find(name);
    if (it == m_namedVariables.end()) {
        // Allocate new variable
        if (m_nextFreeAddress < MEMORY_SIZE) {
            m_namedVariables[name] = m_nextFreeAddress++;
        }
        it = m_namedVariables.find(name);
    }
    return GetVariable(it->second);
}

void JSFXMemory::SetNamedVariable(const std::string& name, double value) {
    GetNamedVariable(name) = value;
}

void JSFXMemory::Clear() {
    std::fill(m_memory.begin(), m_memory.end(), JSFXVariable(0.0));
}

void JSFXMemory::Reset() {
    m_namedVariables.clear();
    m_arrays.clear();
    m_nextFreeAddress = 0;
    Clear();
}

// JSFXBuiltins Implementation
double JSFXBuiltins::sin(double x) { return std::sin(x); }
double JSFXBuiltins::cos(double x) { return std::cos(x); }
double JSFXBuiltins::tan(double x) { return std::tan(x); }
double JSFXBuiltins::asin(double x) { return std::asin(x); }
double JSFXBuiltins::acos(double x) { return std::acos(x); }
double JSFXBuiltins::atan(double x) { return std::atan(x); }
double JSFXBuiltins::atan2(double y, double x) { return std::atan2(y, x); }
double JSFXBuiltins::exp(double x) { return std::exp(x); }
double JSFXBuiltins::log(double x) { return std::log(x); }
double JSFXBuiltins::log10(double x) { return std::log10(x); }
double JSFXBuiltins::pow(double base, double exponent) { return std::pow(base, exponent); }
double JSFXBuiltins::sqrt(double x) { return std::sqrt(x); }
double JSFXBuiltins::abs(double x) { return std::abs(x); }
double JSFXBuiltins::floor(double x) { return std::floor(x); }
double JSFXBuiltins::ceil(double x) { return std::ceil(x); }
double JSFXBuiltins::min(double a, double b) { return std::min(a, b); }
double JSFXBuiltins::max(double a, double b) { return std::max(a, b); }
double JSFXBuiltins::sign(double x) { return (x > 0.0) ? 1.0 : (x < 0.0) ? -1.0 : 0.0; }

double JSFXBuiltins::db2gain(double db) {
    return std::pow(10.0, db / 20.0);
}

double JSFXBuiltins::gain2db(double gain) {
    return 20.0 * std::log10(std::max(gain, 0.0000000001));
}

double JSFXBuiltins::midi2freq(double note) {
    return 440.0 * std::pow(2.0, (note - 69.0) / 12.0);
}

double JSFXBuiltins::freq2midi(double freq) {
    return 69.0 + 12.0 * std::log2(freq / 440.0);
}

double JSFXBuiltins::strcmp(const std::string& a, const std::string& b) {
    if (a == b) return 0.0;
    return (a < b) ? -1.0 : 1.0;
}

std::string JSFXBuiltins::sprintf(const std::string& format, const std::vector<double>& args) {
    // Basic sprintf implementation - would need more complete implementation
    std::string result = format;
    size_t argIndex = 0;
    
    std::regex placeholder("%[difs]");
    std::sregex_iterator iter(format.begin(), format.end(), placeholder);
    std::sregex_iterator end;
    
    for (; iter != end && argIndex < args.size(); ++iter, ++argIndex) {
        std::string match = iter->str();
        std::string replacement;
        
        if (match == "%d" || match == "%i") {
            replacement = std::to_string(static_cast<int>(args[argIndex]));
        } else if (match == "%f") {
            replacement = std::to_string(args[argIndex]);
        } else if (match == "%s") {
            replacement = std::to_string(args[argIndex]); // Basic string conversion
        }
        
        size_t pos = result.find(match);
        if (pos != std::string::npos) {
            result.replace(pos, match.length(), replacement);
        }
    }
    
    return result;
}

// JSFXLexer Implementation
JSFXLexer::JSFXLexer(const std::string& source) 
    : m_source(source), m_position(0), m_line(1), m_column(1) {
}

JSFXToken JSFXLexer::NextToken() {
    SkipWhitespace();
    
    if (m_position >= m_source.length()) {
        return {JSFXTokenType::END_OF_FILE, "", m_line, m_column};
    }
    
    char c = GetChar();
    
    // Comments
    if (c == '/' && PeekChar() == '/') {
        std::string comment;
        while (m_position < m_source.length() && GetChar() != '\n') {
            comment += m_source[m_position - 1];
        }
        return {JSFXTokenType::COMMENT, comment, m_line, m_column};
    }
    
    // Newlines
    if (c == '\n') {
        m_line++;
        m_column = 1;
        return {JSFXTokenType::NEWLINE, "\n", m_line - 1, m_column};
    }
    
    // Numbers
    if (IsDigit(c) || (c == '.' && IsDigit(PeekChar()))) {
        m_position--; // Back up to re-read the digit
        return ReadNumber();
    }
    
    // Strings
    if (c == '"') {
        return ReadString();
    }
    
    // Identifiers and keywords
    if (IsAlpha(c) || c == '_' || c == '@') {
        m_position--; // Back up to re-read the character
        return ReadIdentifier();
    }
    
    // Operators and punctuation
    return ReadOperator();
}

JSFXToken JSFXLexer::PeekToken() {
    size_t savedPos = m_position;
    int savedLine = m_line;
    int savedCol = m_column;
    
    JSFXToken token = NextToken();
    
    m_position = savedPos;
    m_line = savedLine;
    m_column = savedCol;
    
    return token;
}

bool JSFXLexer::HasMoreTokens() const {
    return m_position < m_source.length();
}

char JSFXLexer::GetChar() {
    if (m_position < m_source.length()) {
        char c = m_source[m_position++];
        m_column++;
        return c;
    }
    return '\0';
}

char JSFXLexer::PeekChar() {
    if (m_position < m_source.length()) {
        return m_source[m_position];
    }
    return '\0';
}

void JSFXLexer::SkipWhitespace() {
    while (m_position < m_source.length()) {
        char c = m_source[m_position];
        if (c == ' ' || c == '\t' || c == '\r') {
            m_position++;
            m_column++;
        } else {
            break;
        }
    }
}

JSFXToken JSFXLexer::ReadNumber() {
    std::string number;
    int startCol = m_column;
    
    while (m_position < m_source.length()) {
        char c = m_source[m_position];
        if (IsDigit(c) || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') {
            number += GetChar();
        } else {
            break;
        }
    }
    
    return {JSFXTokenType::NUMBER, number, m_line, startCol};
}

JSFXToken JSFXLexer::ReadString() {
    std::string str;
    int startCol = m_column - 1; // Account for opening quote
    
    while (m_position < m_source.length()) {
        char c = GetChar();
        if (c == '"') {
            break;
        } else if (c == '\\') {
            // Handle escape sequences
            char next = GetChar();
            switch (next) {
                case 'n': str += '\n'; break;
                case 't': str += '\t'; break;
                case 'r': str += '\r'; break;
                case '\\': str += '\\'; break;
                case '"': str += '"'; break;
                default: str += next; break;
            }
        } else {
            str += c;
        }
    }
    
    return {JSFXTokenType::STRING, str, m_line, startCol};
}

JSFXToken JSFXLexer::ReadIdentifier() {
    std::string identifier;
    int startCol = m_column;
    
    while (m_position < m_source.length()) {
        char c = m_source[m_position];
        if (IsAlphaNumeric(c) || c == '_' || c == '@') {
            identifier += GetChar();
        } else {
            break;
        }
    }
    
    // Check for keywords
    JSFXTokenType type = JSFXTokenType::IDENTIFIER;
    if (identifier == "if" || identifier == "else" || identifier == "while" || 
        identifier == "function" || identifier == "loop") {
        type = JSFXTokenType::KEYWORD;
    }
    
    return {type, identifier, m_line, startCol};
}

JSFXToken JSFXLexer::ReadOperator() {
    std::string op;
    int startCol = m_column - 1;
    char c = m_source[m_position - 1];
    
    op += c;
    
    // Handle two-character operators
    if (m_position < m_source.length()) {
        char next = m_source[m_position];
        std::string twoChar = op + next;
        
        if (twoChar == "==" || twoChar == "!=" || twoChar == "<=" || twoChar == ">=" ||
            twoChar == "+=" || twoChar == "-=" || twoChar == "*=" || twoChar == "/=" ||
            twoChar == "&&" || twoChar == "||") {
            GetChar(); // Consume second character
            op = twoChar;
        }
    }
    
    JSFXTokenType type = JSFXTokenType::OPERATOR;
    if (c == '(' || c == ')' || c == '{' || c == '}' || c == '[' || c == ']' ||
        c == ';' || c == ',' || c == ':') {
        type = JSFXTokenType::PUNCTUATION;
    }
    
    return {type, op, m_line, startCol};
}

bool JSFXLexer::IsAlpha(char c) const {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

bool JSFXLexer::IsDigit(char c) const {
    return c >= '0' && c <= '9';
}

bool JSFXLexer::IsAlphaNumeric(char c) const {
    return IsAlpha(c) || IsDigit(c);
}

// JSFXParser Implementation
JSFXParser::JSFXParser(const std::string& source) : m_lexer(source) {
    Consume(); // Load first token
}

std::unique_ptr<JSFXNode> JSFXParser::Parse() {
    return ParseProgram();
}

void JSFXParser::Consume() {
    m_currentToken = m_lexer.NextToken();
    
    // Skip comments and newlines for now
    while (m_currentToken.type == JSFXTokenType::COMMENT || 
           m_currentToken.type == JSFXTokenType::NEWLINE) {
        m_currentToken = m_lexer.NextToken();
    }
}

void JSFXParser::Expect(JSFXTokenType type) {
    if (m_currentToken.type != type) {
        // Error handling - for now just continue
    }
    Consume();
}

std::unique_ptr<JSFXNode> JSFXParser::ParseProgram() {
    auto program = std::make_unique<JSFXNode>(JSFXNodeType::PROGRAM);
    
    while (m_currentToken.type != JSFXTokenType::END_OF_FILE) {
        if (m_currentToken.type == JSFXTokenType::IDENTIFIER && 
            m_currentToken.value[0] == '@') {
            program->AddChild(ParseSection());
        } else {
            program->AddChild(ParseStatement());
        }
    }
    
    return program;
}

std::unique_ptr<JSFXNode> JSFXParser::ParseSection() {
    auto section = std::make_unique<JSFXNode>(JSFXNodeType::SECTION, m_currentToken.value);
    Consume(); // Consume section name (@init, @slider, etc.)
    
    // Parse statements until next section or EOF
    while (m_currentToken.type != JSFXTokenType::END_OF_FILE &&
           !(m_currentToken.type == JSFXTokenType::IDENTIFIER && m_currentToken.value[0] == '@')) {
        section->AddChild(ParseStatement());
    }
    
    return section;
}

std::unique_ptr<JSFXNode> JSFXParser::ParseStatement() {
    if (m_currentToken.type == JSFXTokenType::KEYWORD) {
        if (m_currentToken.value == "if") {
            return ParseIfStatement();
        } else if (m_currentToken.value == "while") {
            return ParseWhileLoop();
        }
    }
    
    // Try to parse as assignment or expression
    return ParseExpression();
}

std::unique_ptr<JSFXNode> JSFXParser::ParseExpression() {
    return ParseAssignment();
}

std::unique_ptr<JSFXNode> JSFXParser::ParseAssignment() {
    auto left = ParseBinaryOp();
    
    if (m_currentToken.type == JSFXTokenType::OPERATOR && 
        (m_currentToken.value == "=" || m_currentToken.value == "+=" || 
         m_currentToken.value == "-=" || m_currentToken.value == "*=" || 
         m_currentToken.value == "/=")) {
        
        auto assignment = std::make_unique<JSFXNode>(JSFXNodeType::ASSIGNMENT, m_currentToken.value);
        Consume();
        
        assignment->AddChild(std::move(left));
        assignment->AddChild(ParseExpression());
        
        return assignment;
    }
    
    return left;
}

std::unique_ptr<JSFXNode> JSFXParser::ParseBinaryOp() {
    auto left = ParseUnaryOp();
    
    while (m_currentToken.type == JSFXTokenType::OPERATOR) {
        std::string op = m_currentToken.value;
        if (op == "+" || op == "-" || op == "*" || op == "/" || 
            op == "==" || op == "!=" || op == "<" || op == ">" ||
            op == "<=" || op == ">=" || op == "&&" || op == "||") {
            
            auto binaryOp = std::make_unique<JSFXNode>(JSFXNodeType::BINARY_OP, op);
            Consume();
            
            binaryOp->AddChild(std::move(left));
            binaryOp->AddChild(ParseUnaryOp());
            
            left = std::move(binaryOp);
        } else {
            break;
        }
    }
    
    return left;
}

std::unique_ptr<JSFXNode> JSFXParser::ParseUnaryOp() {
    if (m_currentToken.type == JSFXTokenType::OPERATOR && 
        (m_currentToken.value == "-" || m_currentToken.value == "!" || m_currentToken.value == "+")) {
        
        auto unaryOp = std::make_unique<JSFXNode>(JSFXNodeType::UNARY_OP, m_currentToken.value);
        Consume();
        
        unaryOp->AddChild(ParsePrimary());
        return unaryOp;
    }
    
    return ParsePrimary();
}

std::unique_ptr<JSFXNode> JSFXParser::ParseFunctionCall() {
    auto functionCall = std::make_unique<JSFXNode>(JSFXNodeType::FUNCTION_CALL, m_currentToken.value);
    Consume(); // Consume function name
    
    Expect(JSFXTokenType::PUNCTUATION); // '('
    
    // Parse arguments
    while (m_currentToken.type != JSFXTokenType::PUNCTUATION || m_currentToken.value != ")") {
        functionCall->AddChild(ParseExpression());
        
        if (m_currentToken.type == JSFXTokenType::PUNCTUATION && m_currentToken.value == ",") {
            Consume();
        }
    }
    
    Expect(JSFXTokenType::PUNCTUATION); // ')'
    
    return functionCall;
}

std::unique_ptr<JSFXNode> JSFXParser::ParsePrimary() {
    if (m_currentToken.type == JSFXTokenType::NUMBER) {
        auto number = std::make_unique<JSFXNode>(JSFXNodeType::NUMBER, m_currentToken.value);
        Consume();
        return number;
    }
    
    if (m_currentToken.type == JSFXTokenType::STRING) {
        auto string = std::make_unique<JSFXNode>(JSFXNodeType::STRING, m_currentToken.value);
        Consume();
        return string;
    }
    
    if (m_currentToken.type == JSFXTokenType::IDENTIFIER) {
        std::string name = m_currentToken.value;
        Consume();
        
        // Check for function call
        if (m_currentToken.type == JSFXTokenType::PUNCTUATION && m_currentToken.value == "(") {
            m_currentToken.value = name; // Restore name for function call parsing
            m_currentToken.type = JSFXTokenType::IDENTIFIER;
            return ParseFunctionCall();
        }
        
        // Check for array access
        if (m_currentToken.type == JSFXTokenType::PUNCTUATION && m_currentToken.value == "[") {
            auto arrayAccess = std::make_unique<JSFXNode>(JSFXNodeType::ARRAY_ACCESS, name);
            Consume(); // '['
            arrayAccess->AddChild(ParseExpression());
            Expect(JSFXTokenType::PUNCTUATION); // ']'
            return arrayAccess;
        }
        
        // Regular variable
        return std::make_unique<JSFXNode>(JSFXNodeType::VARIABLE, name);
    }
    
    if (m_currentToken.type == JSFXTokenType::PUNCTUATION && m_currentToken.value == "(") {
        Consume(); // '('
        auto expr = ParseExpression();
        Expect(JSFXTokenType::PUNCTUATION); // ')'
        return expr;
    }
    
    // Error - return dummy node
    return std::make_unique<JSFXNode>(JSFXNodeType::NUMBER, "0");
}

std::unique_ptr<JSFXNode> JSFXParser::ParseIfStatement() {
    auto ifStmt = std::make_unique<JSFXNode>(JSFXNodeType::IF_STATEMENT);
    Consume(); // 'if'
    
    Expect(JSFXTokenType::PUNCTUATION); // '('
    ifStmt->AddChild(ParseExpression()); // condition
    Expect(JSFXTokenType::PUNCTUATION); // ')'
    
    ifStmt->AddChild(ParseStatement()); // then statement
    
    // Optional else
    if (m_currentToken.type == JSFXTokenType::KEYWORD && m_currentToken.value == "else") {
        Consume();
        ifStmt->AddChild(ParseStatement()); // else statement
    }
    
    return ifStmt;
}

std::unique_ptr<JSFXNode> JSFXParser::ParseWhileLoop() {
    auto whileLoop = std::make_unique<JSFXNode>(JSFXNodeType::WHILE_LOOP);
    Consume(); // 'while'
    
    Expect(JSFXTokenType::PUNCTUATION); // '('
    whileLoop->AddChild(ParseExpression()); // condition
    Expect(JSFXTokenType::PUNCTUATION); // ')'
    
    whileLoop->AddChild(ParseStatement()); // body
    
    return whileLoop;
}

std::unique_ptr<JSFXNode> JSFXParser::ParseBlock() {
    auto block = std::make_unique<JSFXNode>(JSFXNodeType::BLOCK);
    Expect(JSFXTokenType::PUNCTUATION); // '{'
    
    while (m_currentToken.type != JSFXTokenType::PUNCTUATION || m_currentToken.value != "}") {
        if (m_currentToken.type == JSFXTokenType::END_OF_FILE) break;
        block->AddChild(ParseStatement());
    }
    
    Expect(JSFXTokenType::PUNCTUATION); // '}'
    return block;
}

// JSFXContext Implementation
JSFXContext::JSFXContext() {
    slider.resize(64, 0.0); // REAPER supports 64 sliders
    RegisterBuiltins();
}

JSFXContext::~JSFXContext() = default;

void JSFXContext::RegisterBuiltins() {
    // Math functions
    functions["sin"] = [](const std::vector<double>& args) { 
        return args.empty() ? 0.0 : JSFXBuiltins::sin(args[0]); 
    };
    functions["cos"] = [](const std::vector<double>& args) { 
        return args.empty() ? 0.0 : JSFXBuiltins::cos(args[0]); 
    };
    functions["tan"] = [](const std::vector<double>& args) { 
        return args.empty() ? 0.0 : JSFXBuiltins::tan(args[0]); 
    };
    functions["sqrt"] = [](const std::vector<double>& args) { 
        return args.empty() ? 0.0 : JSFXBuiltins::sqrt(args[0]); 
    };
    functions["abs"] = [](const std::vector<double>& args) { 
        return args.empty() ? 0.0 : JSFXBuiltins::abs(args[0]); 
    };
    functions["min"] = [](const std::vector<double>& args) { 
        return args.size() < 2 ? 0.0 : JSFXBuiltins::min(args[0], args[1]); 
    };
    functions["max"] = [](const std::vector<double>& args) { 
        return args.size() < 2 ? 0.0 : JSFXBuiltins::max(args[0], args[1]); 
    };
    functions["floor"] = [](const std::vector<double>& args) { 
        return args.empty() ? 0.0 : JSFXBuiltins::floor(args[0]); 
    };
    functions["ceil"] = [](const std::vector<double>& args) { 
        return args.empty() ? 0.0 : JSFXBuiltins::ceil(args[0]); 
    };
    
    // Audio functions
    functions["db2gain"] = [](const std::vector<double>& args) { 
        return args.empty() ? 0.0 : JSFXBuiltins::db2gain(args[0]); 
    };
    functions["gain2db"] = [](const std::vector<double>& args) { 
        return args.empty() ? 0.0 : JSFXBuiltins::gain2db(args[0]); 
    };
}

JSFXVariable& JSFXContext::GetVariable(const std::string& name) {
    return memory.GetNamedVariable(name);
}

void JSFXContext::SetVariable(const std::string& name, double value) {
    memory.SetNamedVariable(name, value);
}

double JSFXContext::CallFunction(const std::string& name, const std::vector<double>& args) {
    auto it = functions.find(name);
    if (it != functions.end()) {
        return it->second(args);
    }
    return 0.0; // Function not found
}

// JSFXInterpreter Implementation
JSFXInterpreter::JSFXInterpreter() = default;

JSFXInterpreter::~JSFXInterpreter() = default;

bool JSFXInterpreter::LoadScript(const std::string& source) {
    try {
        // Parse script header for metadata
        ParseScriptHeader(source);
        
        // Parse the script into AST
        JSFXParser parser(source);
        m_ast = parser.Parse();
        
        // Find and cache section pointers
        FindSections();
        
        m_initialized = true;
        return true;
    } catch (const std::exception& e) {
        ReportError("Failed to load script: " + std::string(e.what()));
        return false;
    }
}

bool JSFXInterpreter::LoadScriptFromFile(const std::string& filename) {
    // File loading would be implemented here
    // For now, return false
    return false;
}

void JSFXInterpreter::ExecuteInit() {
    if (m_initSection) {
        auto startTime = std::chrono::high_resolution_clock::now();
        ExecuteNode(m_initSection);
        auto endTime = std::chrono::high_resolution_clock::now();
        
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime);
        UpdateCpuUsage(duration.count() / 1000.0);
    }
}

void JSFXInterpreter::ExecuteSlider() {
    if (m_sliderSection) {
        auto startTime = std::chrono::high_resolution_clock::now();
        ExecuteNode(m_sliderSection);
        auto endTime = std::chrono::high_resolution_clock::now();
        
        auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime);
        UpdateCpuUsage(duration.count() / 1000.0);
    }
}

void JSFXInterpreter::ExecuteSample(double inputL, double inputR, double& outputL, double& outputR) {
    if (!m_sampleSection) {
        outputL = inputL;
        outputR = inputR;
        return;
    }
    
    // Set input samples
    m_context.spl0 = inputL;
    m_context.spl1 = inputR;
    
    auto startTime = std::chrono::high_resolution_clock::now();
    
    // Execute @sample section
    ExecuteNode(m_sampleSection);
    
    auto endTime = std::chrono::high_resolution_clock::now();
    
    // Get output samples
    outputL = m_context.spl0;
    outputR = m_context.spl1;
    
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime);
    UpdateCpuUsage(duration.count() / 1000.0);
}

void JSFXInterpreter::ExecuteBlock(AudioBuffer& buffer) {
    if (!m_initialized) return;
    
    int numSamples = buffer.GetSampleCount();
    int numChannels = buffer.GetChannelCount();
    
    for (int i = 0; i < numSamples; ++i) {
        double inputL = (numChannels > 0) ? buffer.GetChannelData(0)[i] : 0.0;
        double inputR = (numChannels > 1) ? buffer.GetChannelData(1)[i] : inputL;
        
        double outputL, outputR;
        ExecuteSample(inputL, inputR, outputL, outputR);
        
        if (numChannels > 0) buffer.GetChannelData(0)[i] = static_cast<float>(outputL);
        if (numChannels > 1) buffer.GetChannelData(1)[i] = static_cast<float>(outputR);
    }
}

void JSFXInterpreter::SetParameter(int index, double value) {
    if (index >= 0 && index < static_cast<int>(m_context.slider.size())) {
        m_context.slider[index] = value;
        
        // Update named slider variables (slider1, slider2, etc.)
        std::string sliderName = "slider" + std::to_string(index + 1);
        m_context.SetVariable(sliderName, value);
        
        // Execute @slider section when parameter changes
        ExecuteSlider();
    }
}

double JSFXInterpreter::GetParameter(int index) const {
    if (index >= 0 && index < static_cast<int>(m_context.slider.size())) {
        return m_context.slider[index];
    }
    return 0.0;
}

int JSFXInterpreter::GetParameterCount() const {
    return static_cast<int>(m_scriptInfo.sliders.size());
}

double JSFXInterpreter::ExecuteNode(JSFXNode* node) {
    if (!node) return 0.0;
    
    switch (node->type) {
        case JSFXNodeType::PROGRAM:
        case JSFXNodeType::SECTION:
        case JSFXNodeType::BLOCK: {
            double result = 0.0;
            for (auto& child : node->children) {
                result = ExecuteNode(child.get());
            }
            return result;
        }
        
        case JSFXNodeType::ASSIGNMENT:
            return ExecuteAssignment(node);
            
        case JSFXNodeType::BINARY_OP:
            return ExecuteBinaryOp(node);
            
        case JSFXNodeType::UNARY_OP:
            return ExecuteUnaryOp(node);
            
        case JSFXNodeType::FUNCTION_CALL:
            return ExecuteFunctionCall(node);
            
        case JSFXNodeType::VARIABLE:
            return ExecuteVariable(node);
            
        case JSFXNodeType::NUMBER:
            return ExecuteNumber(node);
            
        case JSFXNodeType::ARRAY_ACCESS:
            return ExecuteArrayAccess(node);
            
        case JSFXNodeType::IF_STATEMENT:
            return ExecuteIfStatement(node);
            
        case JSFXNodeType::WHILE_LOOP:
            return ExecuteWhileLoop(node);
            
        default:
            return 0.0;
    }
}

double JSFXInterpreter::ExecuteAssignment(JSFXNode* node) {
    if (node->children.size() < 2) return 0.0;
    
    double value = ExecuteNode(node->children[1].get());
    
    // Get the left-hand side variable
    JSFXNode* lhs = node->children[0].get();
    if (lhs->type == JSFXNodeType::VARIABLE) {
        std::string varName = lhs->value;
        
        if (node->value == "=") {
            m_context.SetVariable(varName, value);
        } else if (node->value == "+=") {
            double current = m_context.GetVariable(varName).GetValue();
            m_context.SetVariable(varName, current + value);
        } else if (node->value == "-=") {
            double current = m_context.GetVariable(varName).GetValue();
            m_context.SetVariable(varName, current - value);
        } else if (node->value == "*=") {
            double current = m_context.GetVariable(varName).GetValue();
            m_context.SetVariable(varName, current * value);
        } else if (node->value == "/=") {
            double current = m_context.GetVariable(varName).GetValue();
            m_context.SetVariable(varName, current / value);
        }
        
        return value;
    }
    
    return 0.0;
}

double JSFXInterpreter::ExecuteBinaryOp(JSFXNode* node) {
    if (node->children.size() < 2) return 0.0;
    
    double left = ExecuteNode(node->children[0].get());
    double right = ExecuteNode(node->children[1].get());
    
    if (node->value == "+") return left + right;
    if (node->value == "-") return left - right;
    if (node->value == "*") return left * right;
    if (node->value == "/") return (right != 0.0) ? left / right : 0.0;
    if (node->value == "==") return (left == right) ? 1.0 : 0.0;
    if (node->value == "!=") return (left != right) ? 1.0 : 0.0;
    if (node->value == "<") return (left < right) ? 1.0 : 0.0;
    if (node->value == ">") return (left > right) ? 1.0 : 0.0;
    if (node->value == "<=") return (left <= right) ? 1.0 : 0.0;
    if (node->value == ">=") return (left >= right) ? 1.0 : 0.0;
    if (node->value == "&&") return (left != 0.0 && right != 0.0) ? 1.0 : 0.0;
    if (node->value == "||") return (left != 0.0 || right != 0.0) ? 1.0 : 0.0;
    
    return 0.0;
}

double JSFXInterpreter::ExecuteUnaryOp(JSFXNode* node) {
    if (node->children.empty()) return 0.0;
    
    double operand = ExecuteNode(node->children[0].get());
    
    if (node->value == "-") return -operand;
    if (node->value == "+") return operand;
    if (node->value == "!") return (operand == 0.0) ? 1.0 : 0.0;
    
    return 0.0;
}

double JSFXInterpreter::ExecuteFunctionCall(JSFXNode* node) {
    std::vector<double> args;
    for (auto& child : node->children) {
        args.push_back(ExecuteNode(child.get()));
    }
    
    return m_context.CallFunction(node->value, args);
}

double JSFXInterpreter::ExecuteVariable(JSFXNode* node) {
    // Handle special built-in variables
    if (node->value == "spl0") return m_context.spl0;
    if (node->value == "spl1") return m_context.spl1;
    if (node->value == "srate") return m_context.srate;
    if (node->value == "tempo") return m_context.tempo;
    
    // Handle slider variables
    if (node->value.substr(0, 6) == "slider") {
        int sliderNum = std::stoi(node->value.substr(6)) - 1;
        if (sliderNum >= 0 && sliderNum < static_cast<int>(m_context.slider.size())) {
            return m_context.slider[sliderNum];
        }
    }
    
    return m_context.GetVariable(node->value).GetValue();
}

double JSFXInterpreter::ExecuteNumber(JSFXNode* node) {
    try {
        return std::stod(node->value);
    } catch (...) {
        return 0.0;
    }
}

double JSFXInterpreter::ExecuteArrayAccess(JSFXNode* node) {
    if (node->children.empty()) return 0.0;
    
    int index = static_cast<int>(ExecuteNode(node->children[0].get()));
    int address = m_context.memory.GetArrayAddress(node->value);
    
    if (address >= 0) {
        return m_context.memory.GetVariable(address + index).GetValue();
    }
    
    return 0.0;
}

double JSFXInterpreter::ExecuteIfStatement(JSFXNode* node) {
    if (node->children.empty()) return 0.0;
    
    double condition = ExecuteNode(node->children[0].get());
    
    if (condition != 0.0 && node->children.size() > 1) {
        return ExecuteNode(node->children[1].get()); // then branch
    } else if (condition == 0.0 && node->children.size() > 2) {
        return ExecuteNode(node->children[2].get()); // else branch
    }
    
    return 0.0;
}

double JSFXInterpreter::ExecuteWhileLoop(JSFXNode* node) {
    if (node->children.size() < 2) return 0.0;
    
    double result = 0.0;
    int iterations = 0;
    const int maxIterations = 10000; // Prevent infinite loops
    
    while (ExecuteNode(node->children[0].get()) != 0.0 && iterations < maxIterations) {
        result = ExecuteNode(node->children[1].get());
        iterations++;
    }
    
    return result;
}

void JSFXInterpreter::ParseScriptHeader(const std::string& source) {
    std::istringstream iss(source);
    std::string line;
    
    while (std::getline(iss, line)) {
        if (line.empty()) continue;
        
        // Parse desc: line
        if (line.substr(0, 5) == "desc:") {
            m_scriptInfo.description = line.substr(5);
        }
        
        // Parse slider definitions
        std::regex sliderRegex(R"(slider(\d+):([^<]+)<([^,]+),([^,]+),?([^>]*)>(.*)?)");
        std::smatch match;
        if (std::regex_match(line, match, sliderRegex)) {
            ScriptInfo::SliderInfo slider;
            int sliderNum = std::stoi(match[1].str()) - 1;
            
            slider.defaultValue = std::stod(match[2].str());
            slider.minValue = std::stod(match[3].str());
            slider.maxValue = std::stod(match[4].str());
            slider.step = match[5].str().empty() ? 0.01 : std::stod(match[5].str());
            slider.name = match[6].str();
            
            // Ensure slider vector is large enough
            while (static_cast<int>(m_scriptInfo.sliders.size()) <= sliderNum) {
                m_scriptInfo.sliders.emplace_back();
            }
            m_scriptInfo.sliders[sliderNum] = slider;
            
            // Set default value
            if (sliderNum >= 0 && sliderNum < static_cast<int>(m_context.slider.size())) {
                m_context.slider[sliderNum] = slider.defaultValue;
            }
        }
        
        // Parse in_pin and out_pin
        if (line.substr(0, 7) == "in_pin:") {
            m_scriptInfo.inPins.push_back(line.substr(7));
        } else if (line.substr(0, 8) == "out_pin:") {
            m_scriptInfo.outPins.push_back(line.substr(8));
        }
        
        // Stop parsing header when we hit code sections
        if (line[0] == '@') break;
    }
}

void JSFXInterpreter::FindSections() {
    if (!m_ast) return;
    
    for (auto& child : m_ast->children) {
        if (child->type == JSFXNodeType::SECTION) {
            if (child->value == "@init") {
                m_initSection = child.get();
            } else if (child->value == "@slider") {
                m_sliderSection = child.get();
            } else if (child->value == "@sample") {
                m_sampleSection = child.get();
            } else if (child->value == "@block") {
                m_blockSection = child.get();
            } else if (child->value == "@gfx") {
                m_gfxSection = child.get();
            }
        }
    }
}

void JSFXInterpreter::ReportError(const std::string& message) {
    // Error reporting would be implemented here
    // For now, just ignore
}

void JSFXInterpreter::UpdateCpuUsage(double executionTime) {
    // Simple exponential moving average
    const double alpha = 0.1;
    m_cpuUsage = alpha * executionTime + (1.0 - alpha) * m_cpuUsage;
}

// JSFXEffect Implementation
JSFXEffect::JSFXEffect() : m_interpreter(std::make_unique<JSFXInterpreter>()) {
}

JSFXEffect::~JSFXEffect() = default;

bool JSFXEffect::LoadEffect(const std::string& source) {
    bool success = m_interpreter->LoadScript(source);
    if (success) {
        m_name = m_interpreter->GetScriptInfo().description;
    }
    return success;
}

bool JSFXEffect::LoadEffectFromFile(const std::string& filename) {
    return m_interpreter->LoadScriptFromFile(filename);
}

void JSFXEffect::Initialize(double sampleRate, int maxBlockSize) {
    m_sampleRate = sampleRate;
    m_interpreter->GetContext().srate = sampleRate;
    m_interpreter->ExecuteInit();
    m_initialized = true;
}

void JSFXEffect::Shutdown() {
    m_initialized = false;
}

void JSFXEffect::ProcessSample(double inputL, double inputR, double& outputL, double& outputR) {
    if (!m_initialized || m_bypassed) {
        outputL = inputL;
        outputR = inputR;
        return;
    }
    
    m_interpreter->ExecuteSample(inputL, inputR, outputL, outputR);
}

void JSFXEffect::ProcessBlock(AudioBuffer& buffer) {
    if (!m_initialized || m_bypassed) {
        return;
    }
    
    auto startTime = std::chrono::high_resolution_clock::now();
    
    UpdateAutomation();
    m_interpreter->ExecuteBlock(buffer);
    
    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::microseconds>(endTime - startTime);
    
    // Update CPU usage
    const double alpha = 0.1;
    double currentUsage = duration.count() / 1000.0; // Convert to milliseconds
    m_averageCpuUsage = alpha * currentUsage + (1.0 - alpha) * m_averageCpuUsage;
}

void JSFXEffect::SetParameter(int index, double value) {
    m_interpreter->SetParameter(index, value);
}

double JSFXEffect::GetParameter(int index) const {
    return m_interpreter->GetParameter(index);
}

void JSFXEffect::SetParameterAutomation(int index, const std::vector<double>& values) {
    if (index >= 0 && index < static_cast<int>(m_parameterAutomation.size())) {
        m_parameterAutomation[index].values = values;
        m_parameterAutomation[index].currentIndex = 0;
    }
}

const JSFXInterpreter::ScriptInfo& JSFXEffect::GetInfo() const {
    return m_interpreter->GetScriptInfo();
}

double JSFXEffect::GetCpuUsage() const {
    return m_averageCpuUsage;
}

void JSFXEffect::UpdateAutomation() {
    for (size_t i = 0; i < m_parameterAutomation.size(); ++i) {
        auto& automation = m_parameterAutomation[i];
        if (!automation.values.empty() && automation.currentIndex < automation.values.size()) {
            SetParameter(static_cast<int>(i), automation.values[automation.currentIndex]);
            automation.currentIndex++;
        }
    }
}